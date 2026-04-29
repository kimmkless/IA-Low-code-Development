from __future__ import annotations

import base64
import hashlib
import json
import re
import ast
import csv
from datetime import datetime
from typing import Any


ENVIRONMENT_INDICATORS = [
    "temperature",
    "humidity",
    "light_lux",
    "soil_moisture",
    "pm25",
    "pm10",
    "atmospheric_pressure",
    "co2",
]


def _safe_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_round(value: Any, digits: int = 2) -> float | None:
    numeric = _safe_float(value)
    if numeric is None:
        return None
    return round(numeric, digits)


def _clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(maximum, value))


def _parse_jsonish(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    text = value.strip()
    if not text:
        return {}
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return value


def _walk_numeric_value(value: Any, candidates: set[str]) -> float | None:
    if isinstance(value, dict):
        for key, item in value.items():
            normalized_key = re.sub(r"[^a-z0-9]+", "_", str(key).strip().lower())
            if normalized_key in candidates:
                numeric = _safe_float(item)
                if numeric is not None:
                    return numeric
            found = _walk_numeric_value(item, candidates)
            if found is not None:
                return found
    elif isinstance(value, list):
        for item in value:
            found = _walk_numeric_value(item, candidates)
            if found is not None:
                return found
    return None


def _extract_layer_metric(analysis: dict[str, Any], key_aliases: set[str], fallback: float) -> float:
    direct = _walk_numeric_value(analysis, key_aliases)
    if direct is not None:
        return direct
    timeline = analysis.get("timeline")
    if isinstance(timeline, list) and timeline:
        row = timeline[-1] if isinstance(timeline[-1], dict) else {}
        timeline_value = _walk_numeric_value(row, key_aliases)
        if timeline_value is not None:
            return timeline_value
    predictions = analysis.get("predictions")
    if isinstance(predictions, dict):
        prediction_value = _walk_numeric_value(predictions, key_aliases)
        if prediction_value is not None:
            return prediction_value
    return fallback


def _extract_media_meta(media_source: Any, media_type: str = "", file_name: str = "") -> dict[str, Any]:
    text = str(media_source or "").strip()
    header = ""
    payload = ""
    if text.startswith("data:") and "," in text:
        header, payload = text.split(",", 1)

    guessed_type = media_type or "unknown"
    if header:
        mime = header[5:].split(";", 1)[0]
        if mime.startswith("image/"):
            guessed_type = "image"
        elif mime.startswith("video/"):
            guessed_type = "video"

    fingerprint_source = payload[:2048] if payload else text[:2048]
    fingerprint = hashlib.sha256(fingerprint_source.encode("utf-8", errors="ignore")).hexdigest()[:16]
    size_bytes = None
    if payload:
        try:
            size_bytes = len(base64.b64decode(payload + "=" * (-len(payload) % 4), validate=False))
        except Exception:
            size_bytes = None

    return {
        "kind": guessed_type,
        "fileName": str(file_name or "").strip(),
        "fingerprint": fingerprint,
        "sizeBytes": size_bytes,
        "sourcePreview": text[:180],
        "embedded": text.startswith("data:"),
    }

def _layer_color(value: float, stops: list[tuple[float, str]]) -> str:
    if not stops:
        return "#94a3b8"
    ordered = sorted(stops, key=lambda item: item[0])
    for threshold, color in ordered:
        if value <= threshold:
            return color
    return ordered[-1][1]


def build_media_scene_model(
    media_source: Any,
    analysis_payload: Any = None,
    *,
    media_type: str = "",
    file_name: str = "",
    active_layer: str = "soil_moisture",
    visualization_options: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a lightweight 3D scene contract from imported imagery and analysis data."""
    analysis = _parse_jsonish(analysis_payload)
    if not isinstance(analysis, dict):
        analysis = {}

    options = visualization_options or {}
    meta = _extract_media_meta(media_source, media_type=media_type, file_name=file_name)
    seed = int(meta["fingerprint"][:8], 16)
    columns = int(_clamp(_safe_float(options.get("columns")) or 7, 4, 12))
    rows = int(_clamp(_safe_float(options.get("rows")) or 5, 3, 10))

    threshold_soil_dry = _safe_float(((options.get("thresholds") or {}).get("soil") or {}).get("dry")) or 35.0
    threshold_soil_wet = _safe_float(((options.get("thresholds") or {}).get("soil") or {}).get("wet")) or 62.0
    threshold_rain_light = _safe_float(((options.get("thresholds") or {}).get("rain") or {}).get("light")) or 1.0
    threshold_rain_heavy = _safe_float(((options.get("thresholds") or {}).get("rain") or {}).get("heavy")) or 5.0
    color_scheme = str(options.get("colorScheme") or "default").strip() or "default"

    soil_stops = [(threshold_soil_dry, "#b45309"), (45, "#f59e0b"), (threshold_soil_wet, "#22c55e"), (100, "#0ea5e9")]
    rainfall_stops = [(threshold_rain_light, "#e0f2fe"), (2.0, "#7dd3fc"), (threshold_rain_heavy, "#0284c7"), (100, "#1e3a8a")]
    forecast_stops = [(threshold_rain_light, "#f8fafc"), (2.0, "#a7f3d0"), (threshold_rain_heavy, "#10b981"), (100, "#047857")]
    elevation_stops = [(8, "#bbf7d0"), (13, "#86efac"), (18, "#fde68a"), (100, "#a16207")]
    if color_scheme == "cool":
        soil_stops = [(threshold_soil_dry, "#64748b"), (45, "#38bdf8"), (threshold_soil_wet, "#22d3ee"), (100, "#2563eb")]
        rainfall_stops = [(threshold_rain_light, "#dbeafe"), (2.0, "#60a5fa"), (threshold_rain_heavy, "#2563eb"), (100, "#1e1b4b")]
        forecast_stops = [(threshold_rain_light, "#eff6ff"), (2.0, "#93c5fd"), (threshold_rain_heavy, "#3b82f6"), (100, "#1d4ed8")]
    elif color_scheme == "warm":
        soil_stops = [(threshold_soil_dry, "#92400e"), (45, "#f97316"), (threshold_soil_wet, "#84cc16"), (100, "#14b8a6")]
        rainfall_stops = [(threshold_rain_light, "#fff7ed"), (2.0, "#fdba74"), (threshold_rain_heavy, "#f97316"), (100, "#7c2d12")]
        forecast_stops = [(threshold_rain_light, "#fff7ed"), (2.0, "#fde68a"), (threshold_rain_heavy, "#f59e0b"), (100, "#b45309")]

    indicator_values = analysis.get("indicatorValues") if isinstance(analysis.get("indicatorValues"), dict) else {}
    soil_base = (
        _safe_float(indicator_values.get("soil_moisture"))
        or _safe_float(indicator_values.get("soil_humidity"))
        or _walk_numeric_value(analysis, {"soil_moisture", "soil_humidity", "soil_water", "soil"})
        or 46.0
    )
    humidity_base = (
        _safe_float(indicator_values.get("humidity"))
        or _walk_numeric_value(analysis, {"humidity", "air_humidity"})
        or 64.0
    )
    rainfall_base = _extract_layer_metric(
        analysis,
        {"rainfall", "rain", "precipitation", "precipitation_mm", "next_6h", "next_24h"},
        max(0.0, (humidity_base - 55.0) * 0.22),
    )
    forecast_base = _extract_layer_metric(
        analysis,
        {"rain_forecast", "rainfall_forecast", "forecast_rainfall", "precipitation_forecast", "next_24h"},
        rainfall_base * 1.18,
    )

    terrain: list[dict[str, Any]] = []
    for z in range(rows):
        for x in range(columns):
            wave = ((seed >> ((x + z) % 12)) & 7) - 3
            ridge = abs(x - (columns - 1) / 2) * 1.7 + abs(z - (rows - 1) / 2) * 1.1
            elevation = round(8 + wave * 1.7 + ridge, 2)
            soil = _clamp(soil_base + (2 - z) * 3.1 + (x - 3) * 1.4 + wave * 1.8)
            rainfall = max(0.0, rainfall_base + (z * 0.32) + (wave * 0.12))
            rain_forecast = max(0.0, forecast_base + ((columns - x) * 0.16) + (wave * 0.18))
            terrain.append({
                "x": x,
                "z": z,
                "elevation": elevation,
                "soil_moisture": round(soil, 2),
                "rainfall": round(rainfall, 2),
                "rain_forecast": round(rain_forecast, 2),
                "colors": {
                    "soil_moisture": _layer_color(soil, soil_stops),
                    "rainfall": _layer_color(rainfall, rainfall_stops),
                    "rain_forecast": _layer_color(rain_forecast, forecast_stops),
                    "elevation": _layer_color(elevation, elevation_stops),
                },
            })

    layers = [
        {"key": "soil_moisture", "label": "土壤湿度", "unit": "%", "min": 0, "max": 100},
        {"key": "rainfall", "label": "降雨状况", "unit": "mm", "min": 0, "max": 8},
        {"key": "rain_forecast", "label": "降雨预测", "unit": "mm", "min": 0, "max": 8},
        {"key": "elevation", "label": "地形高程", "unit": "m", "min": 0, "max": 24},
    ]
    valid_layers = {layer["key"] for layer in layers}
    default_layer = str(options.get("defaultLayer") or active_layer or "soil_moisture").strip()
    selected_layer = default_layer if default_layer in valid_layers else "soil_moisture"
    layer_visibility = options.get("layerVisibility") if isinstance(options.get("layerVisibility"), dict) else {}
    visible_layers = [layer["key"] for layer in layers if layer_visibility.get(layer["key"], True)]
    if not visible_layers:
        visible_layers = [layer["key"] for layer in layers]
    score = _safe_float(analysis.get("environmentScore"))
    level = analysis.get("environmentLevel") or "待评估"
    risk_type = analysis.get("riskType") or "待识别"

    def layer_stats(layer_key: str) -> dict[str, Any]:
        values = [_safe_float(tile.get(layer_key)) for tile in terrain]
        values = [item for item in values if item is not None]
        if not values:
            return {"min": None, "max": None, "avg": None}
        return {
            "min": _safe_round(min(values)),
            "max": _safe_round(max(values)),
            "avg": _safe_round(sum(values) / len(values)),
        }

    layer_statistics = {layer["key"]: layer_stats(layer["key"]) for layer in layers}
    hotspots = []
    for tile in terrain:
        soil_value = _safe_float(tile.get("soil_moisture")) or 0.0
        forecast_value = _safe_float(tile.get("rain_forecast")) or 0.0
        if soil_value < threshold_soil_dry:
            hotspots.append({
                "x": tile.get("x"),
                "z": tile.get("z"),
                "type": "dry_soil",
                "label": "偏干地块",
                "metric": "soil_moisture",
                "value": _safe_round(soil_value),
                "priority": "P1",
            })
        if forecast_value >= threshold_rain_heavy:
            hotspots.append({
                "x": tile.get("x"),
                "z": tile.get("z"),
                "type": "heavy_rain_forecast",
                "label": "强降雨关注",
                "metric": "rain_forecast",
                "value": _safe_round(forecast_value),
                "priority": "P2",
            })
    hotspots = hotspots[:8]

    payload = {
        "status": "ok" if media_source else "missing-media",
        "contract": "ia.workflow.media_scene3d.v1",
        "generatedAt": datetime.now().isoformat(),
        "media": meta,
        "analysisBinding": {
            "environmentScore": _safe_round(score),
            "environmentLevel": level,
            "riskType": risk_type,
        },
        "model": {
            "type": "procedural_agri_scene",
            "grid": {"columns": columns, "rows": rows},
            "dimensions": {"width": columns * 12, "depth": rows * 12, "height": 28, "unit": "m"},
            "camera": {"projection": "isometric", "azimuth": 42, "elevation": 34, "zoom": 1},
            "terrain": terrain,
            "objects": [
                {"kind": "sensor_tower", "label": "环境传感塔", "x": 1, "z": 1, "height": 24},
                {"kind": "irrigation_line", "label": "灌溉主管线", "x": max(1, columns // 2), "z": 0, "length": rows},
                {"kind": "rain_gauge", "label": "雨量计", "x": max(0, columns - 2), "z": max(0, rows - 2), "height": 16},
            ],
        },
        "layers": layers,
        "visibleLayers": visible_layers,
        "activeLayer": selected_layer,
        "layerStats": layer_statistics,
        "hotspots": hotspots,
        "screen_contract": {
            "title": "影像三维环境场景",
            "summary": f"基于导入{meta.get('kind', '媒体')}生成 {columns}x{rows} 地块三维模型，当前环境等级为{level}，风险为{risk_type}。",
            "layerControls": layers,
            "defaultLayer": selected_layer,
            "layerStats": layer_statistics,
            "hotspots": hotspots,
            "datasets": {
                "terrain": terrain,
                "objects": [
                    {"kind": "sensor_tower", "label": "环境传感塔", "x": 1, "z": 1},
                    {"kind": "irrigation_line", "label": "灌溉主管线", "x": max(1, columns // 2), "z": 0},
                    {"kind": "rain_gauge", "label": "雨量计", "x": max(0, columns - 2), "z": max(0, rows - 2)},
                ],
            },
            "interactions": {
                "layerSwitch": True,
                "tileTooltip": True,
                "hotspotHighlight": True,
            },
            "legend": {
                "soil_moisture": ["偏干", "适中", "湿润"],
                "rainfall": ["少雨", "中雨", "强降雨"],
                "rain_forecast": ["低概率", "需关注", "高风险"],
            },
            "thresholds": {
                "soil": {"dry": threshold_soil_dry, "wet": threshold_soil_wet},
                "rain": {"light": threshold_rain_light, "heavy": threshold_rain_heavy},
            },
        },
    }
    return {
        **payload,
        "payload": payload,
        "meta": {
            "source": "media_scene_model",
            "mediaInputMode": "embedded" if meta.get("embedded") else ("url" if media_source else "none"),
            "colorScheme": str(options.get("colorScheme") or "default"),
            "activeLayer": selected_layer,
            "generatedAt": payload["generatedAt"],
        },
    }


def normalize_sensor_record(row: dict[str, Any]) -> dict[str, Any]:
    """Convert sensor/database rows to the workflow sensor data contract."""
    raw = row or {}
    raw_json = _parse_jsonish(raw.get("raw_json"))
    properties: dict[str, Any] = {}
    if isinstance(raw_json, dict):
        services = raw_json.get("services") or {}
        if isinstance(services, list) and services:
            properties = services[0].get("properties") or {}
        elif isinstance(services, dict):
            properties = services.get("properties") or {}

    def pick(*keys: str) -> Any:
        for key in keys:
            if key in raw and raw.get(key) is not None:
                return raw.get(key)
            if key in properties and properties.get(key) is not None:
                return properties.get(key)
        return None

    return {
        "temperature": _safe_round(pick("temperature")),
        "humidity": _safe_round(pick("humidity")),
        "light_lux": _safe_round(pick("light_lux", "light"), 0),
        "soil_moisture": _safe_round(pick("soil_moisture", "soil_humidity")),
        "pm25": _safe_round(pick("pm25", "PM25"), 0),
        "pm10": _safe_round(pick("pm10", "PM10"), 0),
        "atmospheric_pressure": _safe_round(pick("atmospheric_pressure")),
        "co2": _safe_round(pick("co2", "CO2")),
        "timestamp": str(pick("timestamp") or datetime.now().isoformat()),
        "device_id": str(pick("device_id") or ""),
    }


def build_data_packet(
    *,
    source_node_type: str,
    source_name: str,
    records: Any,
) -> dict[str, Any]:
    if isinstance(records, dict):
        rows = [records]
    elif isinstance(records, list):
        rows = [row for row in records if isinstance(row, dict)]
    else:
        rows = []

    normalized_records = [normalize_sensor_record(row) for row in rows]
    latest = normalized_records[0] if normalized_records else {}
    return {
        "contract": "ia.workflow.data_packet.v1",
        "sourceNodeType": source_node_type,
        "sourceName": source_name,
        "timestamp": datetime.now().isoformat(),
        "schema": {
            "temperature": "number, Celsius",
            "humidity": "number, percent",
            "light_lux": "number, lux",
            "soil_moisture": "number, percent",
            "pm25": "number, ug/m3",
            "pm10": "number, ug/m3",
            "atmospheric_pressure": "number, hPa",
            "co2": "number, ppm",
            "timestamp": "ISO datetime",
        },
        "latest": latest,
        "records": normalized_records,
    }


def extract_records(payload: Any) -> list[dict[str, Any]]:
    data = _parse_jsonish(payload)
    if isinstance(data, dict):
        records = data.get("records")
        if isinstance(records, list):
            return [normalize_sensor_record(row) for row in records if isinstance(row, dict)]
        latest = data.get("latest")
        if isinstance(latest, dict):
            return [normalize_sensor_record(latest)]
        return [normalize_sensor_record(data)]
    if isinstance(data, list):
        return [normalize_sensor_record(row) for row in data if isinstance(row, dict)]
    if isinstance(data, str):
        return extract_records_from_csv_text(data)
    return []


def _parse_cell_payload(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    text = value.strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        pass
    try:
        return ast.literal_eval(text)
    except Exception:
        return text


def extract_records_from_csv_text(text: str) -> list[dict[str, Any]]:
    raw = str(text or "").strip()
    if not raw:
        return []
    try:
        rows = list(csv.DictReader(raw.splitlines()))
    except Exception:
        return []
    if not rows:
        return []

    records: list[dict[str, Any]] = []
    for row in rows:
        parsed_row = {str(key or "").strip(): _parse_cell_payload(value) for key, value in row.items()}
        nested_records = parsed_row.get("records")
        if isinstance(nested_records, list):
            records.extend(normalize_sensor_record(item) for item in nested_records if isinstance(item, dict))
            continue
        latest = parsed_row.get("latest")
        if isinstance(latest, dict):
            records.append(normalize_sensor_record(latest))
            continue
        normalized = normalize_sensor_record(parsed_row)
        if any(normalized.get(key) is not None for key in ENVIRONMENT_INDICATORS):
            records.append(normalized)
    return records


def _avg(records: list[dict[str, Any]], key: str) -> float | None:
    values = [_safe_float(row.get(key)) for row in records]
    values = [value for value in values if value is not None]
    if not values:
        return None
    return sum(values) / len(values)


def _latest_record(records: list[dict[str, Any]]) -> dict[str, Any]:
    if not records:
        return {}
    return max(records, key=lambda row: str(row.get("timestamp") or ""))


def _stability(records: list[dict[str, Any]], keys: list[str]) -> float:
    values: list[float] = []
    for key in keys:
        values.extend(value for value in (_safe_float(row.get(key)) for row in records) if value is not None)
    if len(values) < 2:
        return 100.0
    mean = sum(values) / len(values)
    variance = sum((value - mean) ** 2 for value in values) / len(values)
    cv = (variance ** 0.5) / (abs(mean) or 1.0)
    return _clamp(100.0 - cv * 100.0)


def score_interval(value: float | None, low: float, high: float, hard_low: float, hard_high: float) -> float:
    if value is None:
        return 0.0
    if low <= value <= high:
        return 100.0
    if value < low:
        return _clamp((value - hard_low) / max(low - hard_low, 1e-6) * 100.0)
    return _clamp((hard_high - value) / max(hard_high - high, 1e-6) * 100.0)


def score_negative(value: float | None, excellent: float, unacceptable: float) -> float:
    if value is None:
        return 100.0
    if value <= excellent:
        return 100.0
    return _clamp((unacceptable - value) / max(unacceptable - excellent, 1e-6) * 100.0)


def enrich_environment_model_contract(result: dict[str, Any], records: list[dict[str, Any]]) -> dict[str, Any]:
    """Add the screen/model contract consumed by agri model, forecast, yield, decision and 3D nodes."""
    indicators = result.get("indicatorValues") if isinstance(result.get("indicatorValues"), dict) else {}
    scores = result.get("indicatorScores") if isinstance(result.get("indicatorScores"), dict) else {}
    latest = _latest_record(records)

    def value(name: str, fallback: float) -> float:
        return _safe_float(latest.get(name)) or _safe_float(indicators.get(name)) or fallback

    env_score = _safe_float(result.get("environmentScore")) or 0.0
    level = result.get("environmentLevel") or "待评估"
    risk_type = result.get("riskType") or "待识别"
    stability = _safe_float(scores.get("stability")) or 70.0
    confidence = _safe_round(max(55.0, min(96.0, stability)))
    temperature = value("temperature", 24.0)
    humidity = value("humidity", 65.0)
    soil = value("soil_moisture", 45.0)
    pm25 = value("pm25", 35.0)
    light = value("light_lux", 15000.0)
    next_temp = _safe_round(temperature + (env_score - 75.0) * 0.015)
    next_humidity = _safe_round(humidity + (70.0 - humidity) * 0.18)
    next_soil = _safe_round(max(0.0, soil - max(0.4, (100.0 - (_safe_float(scores.get("soilMoisture")) or 70.0)) * 0.035)))
    next_light = _safe_round(max(0.0, light * 0.92), 0)
    climate_state = "稳定适生型" if env_score >= 75 else ("待优化波动型" if env_score >= 55 else "高风险压力型")
    risk_score = _safe_round(100.0 - env_score)
    yield_index = _safe_round(env_score * 0.72 + (_safe_float(scores.get("soilMoisture")) or 70.0) * 0.16 + (_safe_float(scores.get("light")) or 70.0) * 0.12)
    estimated_yield = _safe_round(380.0 + (yield_index or 0.0) * 1.35)
    dimension_bars = [
        {"key": "temperatureHumidity", "label": "温湿度适宜", "score": _safe_round(scores.get("temperatureHumidity")), "level": level},
        {"key": "soilMoisture", "label": "土壤水分", "score": _safe_round(scores.get("soilMoisture")), "level": level},
        {"key": "light", "label": "光照活跃", "score": _safe_round(scores.get("light")), "level": level},
        {"key": "airQuality", "label": "空气质量", "score": _safe_round(scores.get("airQuality")), "level": level},
        {"key": "stability", "label": "环境稳定", "score": _safe_round(scores.get("stability")), "level": level},
    ]
    dimension_bars = [item for item in dimension_bars if item["score"] is not None]
    dominant_dimension = max(dimension_bars, key=lambda item: item["score"]) if dimension_bars else {}
    weakest_dimension = min(dimension_bars, key=lambda item: item["score"]) if dimension_bars else {}
    weather_summary = f"未来 6 小时温度约 {next_temp}°C，土壤湿度约 {next_soil}%。"
    factor_bars = [
        {"key": "thermal_score", "label": "热环境适配", "score": _safe_round(scores.get("temperatureHumidity")), "level": level},
        {"key": "soil_score", "label": "土壤供水能力", "score": _safe_round(scores.get("soilMoisture")), "level": level},
        {"key": "light_score", "label": "光照活跃度", "score": _safe_round(scores.get("light")), "level": level},
        {"key": "air_score", "label": "空气洁净度", "score": _safe_round(scores.get("airQuality")), "level": level},
    ]
    decision_modules = [
        {
            "module": "irrigation-controller",
            "action": "择时补水" if (_safe_float(scores.get("soilMoisture")) or 100.0) < 75 else "维持观察",
            "priority": "P1" if (_safe_float(scores.get("soilMoisture")) or 100.0) < 60 else "P2",
            "score": _safe_round(100.0 - (_safe_float(scores.get("soilMoisture")) or 100.0)),
            "reason": f"当前土壤湿度 {soil:.1f}%，预测 6 小时后约 {next_soil}%。",
        },
        {
            "module": "ventilation-controller",
            "action": "联动通风" if (_safe_float(scores.get("temperatureHumidity")) or 100.0) < 70 else "保持低频通风",
            "priority": "P2",
            "score": _safe_round(100.0 - (_safe_float(scores.get("temperatureHumidity")) or 100.0)),
            "reason": f"预测未来 6 小时温度约 {next_temp}°C，湿度约 {next_humidity}%。",
        },
        {
            "module": "air-quality-guard",
            "action": "强化空气质量巡检" if (_safe_float(scores.get("airQuality")) or 100.0) < 75 else "空气质量可控",
            "priority": "P2",
            "score": _safe_round(100.0 - (_safe_float(scores.get("airQuality")) or 100.0)),
            "reason": f"当前 PM2.5 约 {pm25:.1f} μg/m³。",
        },
    ]
    top_decision = max(decision_modules, key=lambda item: item.get("score") or 0.0)
    decision_summary = f"当前优先动作是“{top_decision.get('action')}”，{top_decision.get('reason')}"

    result.update({
        "dataset_profile": {
            "sample_count": len(records),
            "time_end": str(latest.get("timestamp") or ""),
            "features": [key for key, val in indicators.items() if val is not None],
        },
        "latent_state": {
            "dominant_dimension": dominant_dimension,
            "weakest_dimension": weakest_dimension,
            "climate_archetype": climate_state,
            "decision_mode": top_decision.get("action"),
        },
        "predictions": {
            "microclimate_forecast": {
                "status": "ok",
                "sample_count": len(records),
                "microclimate_state": climate_state,
                "weather_summary": weather_summary,
                "confidence": confidence,
                "predictions": {
                    "temperature": {"current": _safe_round(temperature), "next_6h": next_temp, "trend": "up" if (next_temp or 0) > temperature else "down"},
                    "humidity": {"current": _safe_round(humidity), "next_6h": next_humidity, "trend": "up" if (next_humidity or 0) > humidity else "down"},
                    "soil_humidity": {"current": _safe_round(soil), "next_6h": next_soil, "trend": "down"},
                    "light_lux": {"current": _safe_round(light, 0), "next_6h": next_light, "trend": "down"},
                },
            },
            "yield_projection": {
                "status": "ok",
                "yield_index": yield_index,
                "estimated_yield_kg_per_mu": estimated_yield,
                "yield_grade": "稳产潜力" if (yield_index or 0) >= 75 else "待优化",
                "narrative": "农业环境建模结果已联动生成产量评估，可直接供大屏产量卡片消费。",
                "factor_bars": factor_bars,
            },
        },
        "decision_outputs": {
            "status": "ok",
            "risk_score": risk_score,
            "yield_index": yield_index,
            "modules": decision_modules,
            "top_decision": top_decision,
            "decision_summary": decision_summary,
        },
    })
    result["screen_contract"] = {
        "overview": {
            "title": "农业环境建模",
            "summary": f"环境综合评分 {env_score:.2f}，等级为{level}，主要风险为{risk_type}。",
            "sample_count": len(records),
            "updated_at": str(latest.get("timestamp") or ""),
            "climate_archetype": climate_state,
            "risk_score": risk_score,
            "confidence": confidence,
            "dominant_dimension": dominant_dimension,
            "weakest_dimension": weakest_dimension,
            "latest_reading": latest,
            "dimension_bars": dimension_bars,
            "score": _safe_round(env_score),
            "level": level,
            "riskType": risk_type,
        },
        "climate_forecast": {
            "microclimate_state": climate_state,
            "weather_summary": weather_summary,
            "confidence": confidence,
            "cards": [
                {"key": "temperature", "label": "未来6小时温度", "value": next_temp, "unit": "°C", "trend": "上升" if (next_temp or 0) > temperature else "下降"},
                {"key": "humidity", "label": "未来6小时湿度", "value": next_humidity, "unit": "%", "trend": "上升" if (next_humidity or 0) > humidity else "下降"},
                {"key": "soil_humidity", "label": "未来6小时土壤湿度", "value": next_soil, "unit": "%", "trend": "下降"},
                {"key": "light_lux", "label": "未来6小时光照", "value": next_light, "unit": "Lux", "trend": "下降"},
            ],
            "predictions": result["predictions"]["microclimate_forecast"]["predictions"],
        },
        "yield_forecast": {
            "yield_index": yield_index,
            "estimated_yield_kg_per_mu": estimated_yield,
            "yield_grade": "稳产潜力" if (yield_index or 0) >= 75 else "待优化",
            "narrative": "农业环境建模结果已联动生成产量评估，可直接供大屏产量卡片消费。",
            "factor_bars": factor_bars,
        },
        "decision_support": result["decision_outputs"],
        "indicator_bars": dimension_bars,
        "suggestions": result.get("suggestions", []),
    }
    return result


def build_environment_model(input_payload: Any, method: str = "weighted_index") -> dict[str, Any]:
    records = extract_records(input_payload)
    if not records:
        return {
            "status": "insufficient-data",
            "message": "environment_model 未收到上游数据包，请从 get_sensor_info 或 db_query 连线输入标准化数据。",
            "environmentScore": 0,
            "environmentLevel": "无数据",
            "riskType": "无数据流",
            "mainLimitingFactors": ["缺少上游传感器或数据库数据"],
            "suggestions": ["请先连接 get_sensor_info 或 db_query 节点，再连接 environment_model。"],
            "indicatorScores": {},
        }

    indicators = {key: _avg(records, key) for key in ENVIRONMENT_INDICATORS}
    temperature_score = score_interval(indicators["temperature"], 20.0, 28.0, 10.0, 38.0)
    humidity_score = score_interval(indicators["humidity"], 55.0, 75.0, 25.0, 95.0)
    light_score = score_interval(indicators["light_lux"], 12000.0, 26000.0, 2000.0, 42000.0)
    soil_score = score_interval(indicators["soil_moisture"], 42.0, 62.0, 18.0, 82.0)
    pm25_score = score_negative(indicators["pm25"], 35.0, 115.0)
    pm10_score = score_negative(indicators["pm10"], 70.0, 180.0)
    pressure_score = score_interval(indicators["atmospheric_pressure"], 1000.0, 1025.0, 960.0, 1050.0)
    co2_score = score_interval(indicators["co2"], 400.0, 1200.0, 250.0, 1800.0) if indicators["co2"] is not None else 85.0

    score_temp_humidity = temperature_score * 0.55 + humidity_score * 0.45
    score_air_quality = pm25_score * 0.55 + pm10_score * 0.35 + co2_score * 0.10
    score_stability = _stability(records, ["temperature", "humidity", "soil_moisture", "light_lux"])
    indicator_scores = {
        "temperatureHumidity": round(score_temp_humidity, 2),
        "light": round(light_score, 2),
        "soilMoisture": round(soil_score, 2),
        "airQuality": round(score_air_quality, 2),
        "pressure": round(pressure_score, 2),
        "stability": round(score_stability, 2),
    }

    weights = {
        "temperatureHumidity": 0.25,
        "light": 0.18,
        "soilMoisture": 0.24,
        "airQuality": 0.18,
        "pressure": 0.05,
        "stability": 0.10,
    }
    environment_score = sum(indicator_scores[key] * weights[key] for key in weights)

    if environment_score >= 85:
        level = "优秀"
    elif environment_score >= 70:
        level = "良好"
    elif environment_score >= 55:
        level = "一般"
    else:
        level = "较差"

    limiting_map = {
        "temperatureHumidity": "温湿度适宜度不足",
        "light": "光照不足或过强",
        "soilMoisture": "土壤湿度偏离适宜区间",
        "airQuality": "空气质量压力偏高",
        "pressure": "气压偏离稳定区间",
        "stability": "环境波动较大",
    }
    limiting = [
        limiting_map[key]
        for key, value in sorted(indicator_scores.items(), key=lambda item: item[1])
        if value < 75
    ][:3]

    suggestions = []
    if indicator_scores["soilMoisture"] < 75:
        suggestions.append("建议根据土壤湿度执行分区灌溉或排水。")
    if indicator_scores["light"] < 75:
        suggestions.append("建议调整遮阳、补光或作物冠层管理。")
    if indicator_scores["temperatureHumidity"] < 75:
        suggestions.append("建议联动通风、喷雾或保温设备稳定温湿度。")
    if indicator_scores["airQuality"] < 75:
        suggestions.append("建议检查过滤、通风和粉尘来源。")
    if not suggestions:
        suggestions.append("当前环境整体可控，建议保持监测频率。")

    if indicator_scores["soilMoisture"] < 60:
        risk_type = "轻度干旱风险" if (indicators["soil_moisture"] or 0) < 42 else "渍害风险"
    elif indicator_scores["airQuality"] < 60:
        risk_type = "空气质量风险"
    elif indicator_scores["temperatureHumidity"] < 60:
        risk_type = "温湿度胁迫风险"
    else:
        risk_type = "低风险"

    result = {
        "status": "ok",
        "contract": "ia.workflow.environment_model.v1",
        "method": method if method in {"weighted_index", "entropy_weight", "topsis", "grey_relation"} else "weighted_index",
        "methodImplemented": "weighted_index",
        "sampleCount": len(records),
        "environmentScore": round(environment_score, 2),
        "environmentLevel": level,
        "riskType": risk_type,
        "mainLimitingFactors": limiting or ["暂无明显限制因子"],
        "suggestions": suggestions,
        "indicatorValues": {key: _safe_round(value) for key, value in indicators.items()},
        "indicatorScores": indicator_scores,
        "modelBasis": {
            "literatureIndicatorSources": [
                "设施农业与温室环境监测常用温度、湿度、光照、土壤水分、CO2、颗粒物和气压等传感器指标。",
                "耕地质量评价通常从土壤理化性状、水分、养分、有机质、pH、灌溉排水能力、清洁程度和障碍因素构建指标体系。",
                "农业绿色发展评价常使用熵权法、TOPSIS、灰色关联分析和综合指数法进行多指标综合评价。",
            ],
            "indicatorSystem": {
                "microclimate": ["temperature", "humidity", "light_lux", "atmospheric_pressure", "co2"],
                "soilWater": ["soil_moisture"],
                "airQuality": ["pm25", "pm10"],
                "stability": ["temperature", "humidity", "soil_moisture", "light_lux"],
            },
            "scoreRules": {
                "interval": "适宜区间型指标在适宜区间得 100 分，向硬阈值线性衰减到 0 分。",
                "negative": "负向指标低于优良阈值得 100 分，向不可接受阈值线性衰减到 0 分。",
                "weightedIndex": weights,
            },
        },
        "screen_contract": {
            "overview": {
                "score": round(environment_score, 2),
                "level": level,
                "riskType": risk_type,
                "summary": f"环境综合评分 {round(environment_score, 2)}，等级为{level}，主要风险为{risk_type}。",
            },
            "indicator_bars": [
                {"key": key, "label": label, "score": indicator_scores[key]}
                for key, label in [
                    ("temperatureHumidity", "温湿度"),
                    ("light", "光照"),
                    ("soilMoisture", "土壤水分"),
                    ("airQuality", "空气质量"),
                    ("stability", "稳定性"),
                ]
            ],
            "suggestions": suggestions,
        },
    }

    return enrich_environment_model_contract(result, records)

def build_environment_analysis_summary(input_payload: Any, analysis_type: str = "overview") -> dict[str, Any]:
    data = _parse_jsonish(input_payload)
    if not isinstance(data, dict) or "environmentScore" not in data:
        data = build_environment_model(data)

    contract = data.get("screen_contract") if isinstance(data.get("screen_contract"), dict) else {}
    if analysis_type == "forecast":
        return {
            "status": data.get("status", "ok"),
            "analysisType": "forecast",
            **(contract.get("climate_forecast") or {}),
        }
    if analysis_type == "yield":
        return {
            "status": data.get("status", "ok"),
            "analysisType": "yield",
            **(contract.get("yield_forecast") or {}),
        }
    if analysis_type == "decision":
        return {
            "status": data.get("status", "ok"),
            "analysisType": "decision",
            **(contract.get("decision_support") or {}),
        }
    if analysis_type == "report":
        overview = contract.get("overview") or {}
        return {
            "status": data.get("status", "ok"),
            "analysisType": "report",
            "summary": overview.get("summary"),
            "environmentScore": data.get("environmentScore"),
            "environmentLevel": data.get("environmentLevel"),
            "riskType": data.get("riskType"),
            "suggestions": data.get("suggestions", []),
            "indicatorScores": data.get("indicatorScores", {}),
        }
    if analysis_type == "alerts":
        return {
            "status": data.get("status", "ok"),
            "alerts": [
                {
                    "level": "high" if data.get("environmentScore", 0) < 55 else "medium",
                    "riskType": data.get("riskType"),
                    "factors": data.get("mainLimitingFactors", []),
                }
            ] if data.get("riskType") not in {None, "低风险"} else [],
        }
    if analysis_type == "recommendations":
        return {
            "status": data.get("status", "ok"),
            "recommendations": data.get("suggestions", []),
            "mainLimitingFactors": data.get("mainLimitingFactors", []),
        }
    return {
        "status": data.get("status", "ok"),
        "analysisType": analysis_type,
        "environmentScore": data.get("environmentScore"),
        "environmentLevel": data.get("environmentLevel"),
        "riskType": data.get("riskType"),
        "indicatorScores": data.get("indicatorScores", {}),
        "summary": (data.get("screen_contract") or {}).get("overview", {}).get("summary"),
    }
