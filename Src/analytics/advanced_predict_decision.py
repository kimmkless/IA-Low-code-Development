#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
高级预测与辅助决策分析工具。

这个模块既支持命令行调用，也支持被 Flask 后端直接导入调用，
用于从 SQLite 的 sensor_data 表中生成：

1. 原始数据趋势图
2. 历史值 + 预测值对比图
3. 特征重要性图
4. 相关性热力图
5. 异常点检测图
6. 模型对比 CSV
7. 决策报告 JSON
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sqlite3
from pathlib import Path
from typing import Any

ANALYTICS_IMPORT_ERROR: ModuleNotFoundError | None = None

try:
    import matplotlib

    matplotlib.use("Agg")

    import matplotlib.pyplot as plt
    import numpy as np
    import pandas as pd
    from matplotlib import font_manager as fm
    from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
    from sklearn.metrics import mean_absolute_error, r2_score
except ModuleNotFoundError as exc:  # pragma: no cover - depends on local env
    ANALYTICS_IMPORT_ERROR = exc
    plt = None
    np = None
    pd = None
    fm = None
    GradientBoostingRegressor = None
    RandomForestRegressor = None
    mean_absolute_error = None
    r2_score = None


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = PROJECT_ROOT / "data" / "iot_sensor_data.db"
DEFAULT_OUTPUT_ROOT = PROJECT_ROOT / "data" / "analytics" / "advanced_prediction"

VALID_COLUMNS = {
    "temperature": "空气温度（℃）",
    "humidity": "空气湿度（%）",
    "noise": "噪声",
    "pm25": "PM2.5",
    "pm10": "PM10",
    "atmospheric_pressure": "大气压",
    "light_lux": "光照强度（Lux）",
    "soil_temperature": "土壤温度（℃）",
    "soil_humidity": "土壤湿度（%）",
    "soil_conductivity": "土壤电导率",
}


def ensure_runtime_dependencies() -> None:
    if ANALYTICS_IMPORT_ERROR is None:
        return
    raise RuntimeError(
        "高级预测分析依赖未安装，请先执行 "
        "`pip install numpy pandas matplotlib scikit-learn`。"
    ) from ANALYTICS_IMPORT_ERROR


def safe_name(value: str) -> str:
    text = re.sub(r"[^0-9A-Za-z._-]+", "_", str(value or "").strip())
    return text.strip("._") or "default"


def setup_chinese_font() -> None:
    ensure_runtime_dependencies()
    font_candidates = [
        "Noto Sans CJK JP",
        "Noto Sans CJK SC",
        "SimHei",
        "Microsoft YaHei",
        "Arial Unicode MS",
    ]
    available = {font.name for font in fm.fontManager.ttflist}
    for candidate in font_candidates:
        if candidate in available:
            plt.rcParams["font.family"] = candidate
            break
    plt.rcParams["axes.unicode_minus"] = False


def build_output_dir(
    target: str,
    device_id: str = "SmartAgriculture_thermometer",
    output_root: str | Path | None = None,
) -> Path:
    root = Path(output_root) if output_root else DEFAULT_OUTPUT_ROOT
    return root / safe_name(device_id) / safe_name(target)


def normalize_feature_columns(target: str, feature_cols: list[str] | None) -> list[str]:
    normalized = [target]
    for column in feature_cols or []:
        if column not in normalized:
            normalized.append(column)
    for column in normalized:
        if column not in VALID_COLUMNS:
            raise ValueError(f"非法字段: {column}")
    return normalized


def load_dataframe(db_path: str | Path, columns: list[str], device_id: str | None = None):
    ensure_runtime_dependencies()
    unique_columns = list(dict.fromkeys(columns))
    col_sql = ", ".join(["timestamp"] + unique_columns)
    conn = sqlite3.connect(str(db_path))
    try:
        query = f"SELECT {col_sql} FROM sensor_data"
        params: list[Any] = []
        if device_id:
            query += " WHERE device_id = ?"
            params.append(device_id)
        query += " ORDER BY timestamp"
        df = pd.read_sql_query(query, conn, params=params, parse_dates=["timestamp"])
    finally:
        conn.close()
    if df.empty:
        scope = f"设备 {device_id}" if device_id else "当前数据库"
        raise ValueError(f"{scope} 中没有可用于高级预测分析的传感器数据。")
    return df


def build_resampled_df(df, columns: list[str], rule: str):
    ensure_runtime_dependencies()
    rdf = (
        df.set_index("timestamp")[columns]
        .resample(rule)
        .mean()
        .interpolate("time")
        .dropna(how="all")
    )
    if rdf.empty:
        raise ValueError("重采样后没有得到有效数据，请调整采样频率或扩大时间范围。")
    return rdf


def add_features(df, target: str, feature_cols: list[str], lags: int):
    ensure_runtime_dependencies()
    data = df.copy()
    used_cols = [target] + [column for column in feature_cols if column != target]

    for lag in range(1, lags + 1):
        data[f"{target}_lag_{lag}"] = data[target].shift(lag)

    data[f"{target}_roll_mean_3"] = data[target].rolling(3).mean()
    data[f"{target}_roll_std_3"] = data[target].rolling(3).std()
    data[f"{target}_roll_mean_7"] = data[target].rolling(7).mean()
    data[f"{target}_roll_std_7"] = data[target].rolling(7).std()

    for column in used_cols:
        if column == target:
            continue
        data[f"{column}_cur"] = data[column]
        data[f"{column}_lag_1"] = data[column].shift(1)
        data[f"{column}_lag_2"] = data[column].shift(2)

    data = data.dropna().copy()
    if data.empty:
        raise ValueError("特征构建后没有剩余样本，请减少滞后步数或扩大窗口。")
    return data


def train_best_model(feature_df, target: str):
    ensure_runtime_dependencies()
    y = feature_df[target].values
    x = feature_df.drop(columns=[target]).values
    feature_names = feature_df.drop(columns=[target]).columns.tolist()

    sample_count = len(feature_df)
    if sample_count < 20:
        raise ValueError("样本量过少，建议至少保留 20 个重采样后的时间点。")

    split = max(int(sample_count * 0.8), sample_count - 10)
    split = min(split, sample_count - 3)

    x_train, x_test = x[:split], x[split:]
    y_train, y_test = y[:split], y[split:]

    models = {
        "RandomForest": RandomForestRegressor(
            n_estimators=300,
            max_depth=8,
            min_samples_leaf=2,
            random_state=42,
        ),
        "GradientBoosting": GradientBoostingRegressor(
            n_estimators=250,
            learning_rate=0.05,
            max_depth=3,
            random_state=42,
        ),
    }

    results: list[dict[str, Any]] = []
    best_name = ""
    best_mae = None

    for name, model in models.items():
        model.fit(x_train, y_train)
        pred = model.predict(x_test)
        mae = mean_absolute_error(y_test, pred)
        r2 = r2_score(y_test, pred) if len(y_test) > 1 else np.nan
        results.append({"model": name, "mae": float(mae), "r2": float(r2)})

        if best_mae is None or mae < best_mae:
            best_mae = mae
            best_name = name

    best_model = models[best_name]
    best_model.fit(x, y)

    result_df = pd.DataFrame(results).sort_values("mae")
    return best_model, result_df, feature_names


def recursive_forecast(base_df, target: str, feature_cols: list[str], model, lags: int, steps: int):
    ensure_runtime_dependencies()
    history = base_df.copy()
    preds: list[tuple[Any, float]] = []

    for _ in range(steps):
        feat_df = add_features(history, target, feature_cols, lags)
        last_row = feat_df.drop(columns=[target]).iloc[-1:].copy()
        pred = float(model.predict(last_row.values)[0])

        if len(history) >= 2:
            next_idx = history.index[-1] + (history.index[-1] - history.index[-2])
        else:
            next_idx = history.index[-1] + pd.Timedelta(days=1)

        next_row = history.iloc[-1:].copy()
        next_row.index = [next_idx]
        next_row[target] = pred

        for column in feature_cols:
            if column != target:
                next_row[column] = history[column].iloc[-1]

        history = pd.concat([history, next_row])
        preds.append((next_idx, pred))

    return pd.Series(
        data=[value for _, value in preds],
        index=pd.DatetimeIndex([timestamp for timestamp, _ in preds]),
        name="forecast",
    )


def detect_anomaly(series):
    ensure_runtime_dependencies()
    q1 = series.quantile(0.25)
    q3 = series.quantile(0.75)
    iqr = q3 - q1
    low = q1 - 1.5 * iqr
    high = q3 + 1.5 * iqr
    mask = (series < low) | (series > high)
    return mask, low, high


def save_raw_plot(series, ylabel: str, path: Path) -> None:
    fig, ax = plt.subplots(figsize=(10, 5), dpi=180)
    ax.plot(series.index, series.values, linewidth=1.8)
    ax.set_title(f"{ylabel}原始数据曲线")
    ax.set_xlabel("时间")
    ax.set_ylabel(ylabel)
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)


def save_forecast_plot(series, forecast, ylabel: str, path: Path) -> None:
    fig, ax = plt.subplots(figsize=(11, 5.5), dpi=180)
    ax.plot(series.index, series.values, label="历史数据", linewidth=1.8)
    ax.plot(forecast.index, forecast.values, label="预测曲线", linewidth=2.0)
    ax.axvline(series.index[-1], linestyle="--", alpha=0.7)
    ax.text(series.index[-1], max(series.max(), forecast.max()), "预测起点", ha="right", va="bottom")
    ax.set_title(f"{ylabel}历史数据与预测对比")
    ax.set_xlabel("时间")
    ax.set_ylabel(ylabel)
    ax.legend()
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)


def save_feature_importance_plot(model, feature_names: list[str], path: Path) -> None:
    if not hasattr(model, "feature_importances_"):
        return
    importance = pd.Series(model.feature_importances_, index=feature_names).sort_values(ascending=False).head(12)
    fig, ax = plt.subplots(figsize=(10, 5.5), dpi=180)
    importance.sort_values().plot(kind="barh", ax=ax)
    ax.set_title("特征重要性分析")
    ax.set_xlabel("重要性")
    ax.set_ylabel("特征")
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)


def save_corr_heatmap(df, columns: list[str], path: Path) -> None:
    corr = df[columns].corr()
    fig, ax = plt.subplots(figsize=(7, 6), dpi=180)
    im = ax.imshow(corr.values, aspect="auto")
    ax.set_xticks(range(len(corr.columns)))
    ax.set_yticks(range(len(corr.index)))
    ax.set_xticklabels([VALID_COLUMNS.get(column, column) for column in corr.columns], rotation=45, ha="right")
    ax.set_yticklabels([VALID_COLUMNS.get(column, column) for column in corr.index])
    ax.set_title("关键变量相关性热力图")
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)


def save_anomaly_plot(series, ylabel: str, path: Path) -> None:
    mask, low, high = detect_anomaly(series)
    fig, ax = plt.subplots(figsize=(10, 5), dpi=180)
    ax.plot(series.index, series.values, label="历史数据", linewidth=1.5)
    ax.scatter(series.index[mask], series.values[mask], label="异常点", s=20)
    ax.axhline(low, linestyle="--", alpha=0.6)
    ax.axhline(high, linestyle="--", alpha=0.6)
    ax.set_title(f"{ylabel}异常点检测")
    ax.set_xlabel("时间")
    ax.set_ylabel(ylabel)
    ax.legend()
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)


def make_decision_report(
    target_label: str,
    forecast,
    low_threshold: float | None,
    high_threshold: float | None,
    out_path: Path,
) -> dict[str, Any]:
    mean_pred = float(forecast.mean())
    min_pred = float(forecast.min())
    max_pred = float(forecast.max())

    advice: list[str] = []
    risk_level = "正常"

    if low_threshold is not None and min_pred < low_threshold:
        risk_level = "偏低风险"
        advice.append(
            f"预测期内最低值为 {min_pred:.2f}，低于下限 {low_threshold:.2f}，"
            "建议提前安排补水、增湿或保温干预。"
        )

    if high_threshold is not None and max_pred > high_threshold:
        risk_level = "偏高风险" if risk_level == "正常" else "复合风险"
        advice.append(
            f"预测期内最高值为 {max_pred:.2f}，高于上限 {high_threshold:.2f}，"
            "建议及时进行通风、降温或排涝等处置。"
        )

    if not advice:
        advice.append("预测结果整体处于安全区间，建议维持当前管理策略并继续观察趋势变化。")

    report = {
        "target": target_label,
        "forecast_mean": round(mean_pred, 4),
        "forecast_min": round(min_pred, 4),
        "forecast_max": round(max_pred, 4),
        "risk_level": risk_level,
        "advice": advice,
    }

    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def build_relative_file_map(files: dict[str, Path], base_dir: str | Path | None = None) -> dict[str, str]:
    base_path = Path(base_dir) if base_dir else DEFAULT_OUTPUT_ROOT
    base_resolved = base_path.resolve()
    relative: dict[str, str] = {}
    for key, path in files.items():
        try:
            relative[key] = str(path.resolve().relative_to(base_resolved))
        except ValueError:
            relative[key] = str(path)
    return relative


def series_to_records(series) -> list[dict[str, Any]]:
    return [
        {
            "timestamp": str(index),
            "value": round(float(value), 4),
        }
        for index, value in series.items()
    ]


def csv_to_records(csv_path: Path) -> list[dict[str, Any]]:
    if not csv_path.exists():
        return []
    with csv_path.open("r", encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def load_prediction_artifacts(
    target: str,
    device_id: str = "SmartAgriculture_thermometer",
    output_root: str | Path | None = None,
) -> dict[str, Any] | None:
    out_dir = build_output_dir(target=target, device_id=device_id, output_root=output_root)
    if not out_dir.exists():
        return None

    files = {
        "raw_plot": out_dir / f"{target}_raw.png",
        "forecast_plot": out_dir / f"{target}_forecast.png",
        "feature_importance_plot": out_dir / f"{target}_feature_importance.png",
        "corr_heatmap_plot": out_dir / f"{target}_corr_heatmap.png",
        "anomaly_plot": out_dir / f"{target}_anomaly.png",
        "model_compare_csv": out_dir / f"{target}_model_compare.csv",
        "decision_report_json": out_dir / f"{target}_decision_report.json",
        "manifest_json": out_dir / f"{target}_analysis_manifest.json",
    }

    if not any(path.exists() for path in files.values()):
        return None

    decision_report = {}
    report_path = files["decision_report_json"]
    if report_path.exists():
        try:
            decision_report = json.loads(report_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            decision_report = {}

    result = {
        "device_id": device_id,
        "target": target,
        "output_dir": str(out_dir),
        "files": {key: str(path) for key, path in files.items() if path.exists()},
        "relative_files": build_relative_file_map(
            {key: path for key, path in files.items() if path.exists()},
            base_dir=Path(output_root) if output_root else DEFAULT_OUTPUT_ROOT,
        ),
        "model_compare": csv_to_records(files["model_compare_csv"]),
        "decision_report": decision_report,
        "generated": False,
    }

    return result


def run_prediction_analysis(
    *,
    db_path: str | Path = DEFAULT_DB_PATH,
    target: str,
    feature_cols: list[str] | None = None,
    device_id: str | None = "SmartAgriculture_thermometer",
    resample: str = "D",
    window: int = 120,
    lags: int = 7,
    forecast_steps: int = 7,
    low_threshold: float | None = None,
    high_threshold: float | None = None,
    output_dir: str | Path | None = None,
) -> dict[str, Any]:
    ensure_runtime_dependencies()
    setup_chinese_font()

    normalized_target = str(target or "").strip()
    if normalized_target not in VALID_COLUMNS:
        raise ValueError(f"不支持的预测字段: {normalized_target}")

    normalized_device_id = str(device_id or "").strip() or "SmartAgriculture_thermometer"
    normalized_features = normalize_feature_columns(normalized_target, feature_cols)
    out_dir = Path(output_dir) if output_dir else build_output_dir(normalized_target, normalized_device_id)
    out_dir.mkdir(parents=True, exist_ok=True)

    df = load_dataframe(db_path=db_path, columns=normalized_features, device_id=normalized_device_id)
    rdf = build_resampled_df(df, normalized_features, resample)

    if window > 0 and len(rdf) > window:
        rdf = rdf.tail(window)

    target_label = VALID_COLUMNS[normalized_target]
    series = rdf[normalized_target].dropna()
    if len(series) < max(lags + 3, 10):
        raise ValueError("有效时间序列样本不足，无法完成预测，请扩大窗口或降低滞后步数。")

    feature_df = add_features(rdf, normalized_target, normalized_features, lags)
    model, compare_df, feature_names = train_best_model(feature_df, normalized_target)
    forecast = recursive_forecast(rdf, normalized_target, normalized_features, model, lags, forecast_steps)

    files = {
        "raw_plot": out_dir / f"{normalized_target}_raw.png",
        "forecast_plot": out_dir / f"{normalized_target}_forecast.png",
        "feature_importance_plot": out_dir / f"{normalized_target}_feature_importance.png",
        "corr_heatmap_plot": out_dir / f"{normalized_target}_corr_heatmap.png",
        "anomaly_plot": out_dir / f"{normalized_target}_anomaly.png",
        "model_compare_csv": out_dir / f"{normalized_target}_model_compare.csv",
        "decision_report_json": out_dir / f"{normalized_target}_decision_report.json",
        "manifest_json": out_dir / f"{normalized_target}_analysis_manifest.json",
    }

    save_raw_plot(series, target_label, files["raw_plot"])
    save_forecast_plot(series, forecast, target_label, files["forecast_plot"])
    save_feature_importance_plot(model, feature_names, files["feature_importance_plot"])
    save_corr_heatmap(rdf, normalized_features, files["corr_heatmap_plot"])
    save_anomaly_plot(series, target_label, files["anomaly_plot"])
    compare_df.to_csv(files["model_compare_csv"], index=False, encoding="utf-8-sig")
    decision_report = make_decision_report(
        target_label=target_label,
        forecast=forecast,
        low_threshold=low_threshold,
        high_threshold=high_threshold,
        out_path=files["decision_report_json"],
    )

    result = {
        "generated": True,
        "device_id": normalized_device_id,
        "target": normalized_target,
        "target_label": target_label,
        "db_path": str(db_path),
        "output_dir": str(out_dir),
        "feature_columns": normalized_features,
        "resample_rule": resample,
        "window": window,
        "lags": lags,
        "forecast_steps": forecast_steps,
        "history_points": int(len(series)),
        "history_range": {
            "start": str(series.index.min()),
            "end": str(series.index.max()),
        },
        "forecast_series": series_to_records(forecast),
        "model_compare": compare_df.to_dict(orient="records"),
        "decision_report": decision_report,
        "files": {key: str(path) for key, path in files.items()},
        "relative_files": build_relative_file_map(files, base_dir=DEFAULT_OUTPUT_ROOT),
    }

    files["manifest_json"].write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return result


def parse_cli_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="高级预测与辅助决策分析")
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH), help="SQLite 数据库路径")
    parser.add_argument("--device-id", default="SmartAgriculture_thermometer", help="设备 ID")
    parser.add_argument("--target", required=True, choices=list(VALID_COLUMNS.keys()), help="目标预测字段")
    parser.add_argument("--features", nargs="*", default=None, help="辅助特征字段列表")
    parser.add_argument("--resample", default="D", help="重采样频率，例如 H / D / W")
    parser.add_argument("--window", type=int, default=120, help="使用最近多少个重采样点")
    parser.add_argument("--lags", type=int, default=7, help="使用多少个滞后步")
    parser.add_argument("--forecast", type=int, default=7, help="预测未来多少步")
    parser.add_argument("--low-threshold", type=float, default=None, help="辅助决策下阈值")
    parser.add_argument("--high-threshold", type=float, default=None, help="辅助决策上阈值")
    parser.add_argument("--output", default="", help="输出目录，不填则写入 data/analytics/advanced_prediction")
    return parser.parse_args()


def main() -> None:
    args = parse_cli_args()
    result = run_prediction_analysis(
        db_path=args.db,
        device_id=args.device_id,
        target=args.target,
        feature_cols=args.features,
        resample=args.resample,
        window=args.window,
        lags=args.lags,
        forecast_steps=args.forecast,
        low_threshold=args.low_threshold,
        high_threshold=args.high_threshold,
        output_dir=args.output or None,
    )

    print("高级预测与辅助决策分析完成。")
    print(f"设备 ID：{result['device_id']}")
    print(f"目标字段：{result['target']}")
    print(f"输出目录：{result['output_dir']}")
    print("决策摘要：")
    print(json.dumps(result["decision_report"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
