from __future__ import annotations

import sys
from collections import deque
from typing import Deque, Dict, Optional, Protocol, Tuple

import pyqtgraph as pg
from PySide6.QtCore import QTimer, Qt
from PySide6.QtGui import QFont
from PySide6.QtWidgets import (
    QApplication,
    QCheckBox,
    QComboBox,
    QGridLayout,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QMainWindow,
    QPushButton,
    QSpinBox,
    QVBoxLayout,
    QWidget,
)

try:
    from .motion_estimator import GravityCompensatedVelocityEstimator, MotionEstimate
    from .serial_reader import ImuSample, SerialImuSource, SIMULATED_PORT_NAME
    from .simulator import SimulatedImuSource
except ImportError:
    from motion_estimator import GravityCompensatedVelocityEstimator, MotionEstimate
    from serial_reader import ImuSample, SerialImuSource, SIMULATED_PORT_NAME
    from simulator import SimulatedImuSource


APP_TITLE = "ESP32 IMU Viewer"
DEFAULT_BAUDRATE = 115200
DEFAULT_HISTORY_SECONDS = 15.0
POLL_INTERVAL_MS = 20
UI_REFRESH_INTERVAL_MS = 50
MAX_BUFFERED_SAMPLES = 5000


class ImuSource(Protocol):
    connected_name: str
    good_lines: int
    bad_lines: int

    @property
    def is_connected(self) -> bool:
        ...

    def connect(self, port_name: str, baud_rate: int):
        ...

    def disconnect(self) -> None:
        ...

    def poll(self, max_lines: int = 250):
        ...


class ImuViewerWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()

        self.setWindowTitle(APP_TITLE)
        self.resize(1260, 980)

        self.history_seconds = DEFAULT_HISTORY_SECONDS
        self.source: Optional[ImuSource] = None
        self.latest_sample: Optional[ImuSample] = None
        self.latest_motion_estimate: Optional[MotionEstimate] = None
        self.motion_estimator = GravityCompensatedVelocityEstimator()

        self.timestamps: Deque[float] = deque(maxlen=MAX_BUFFERED_SAMPLES)
        self.ax_data: Deque[float] = deque(maxlen=MAX_BUFFERED_SAMPLES)
        self.ay_data: Deque[float] = deque(maxlen=MAX_BUFFERED_SAMPLES)
        self.az_data: Deque[float] = deque(maxlen=MAX_BUFFERED_SAMPLES)
        self.gx_data: Deque[float] = deque(maxlen=MAX_BUFFERED_SAMPLES)
        self.gy_data: Deque[float] = deque(maxlen=MAX_BUFFERED_SAMPLES)
        self.gz_data: Deque[float] = deque(maxlen=MAX_BUFFERED_SAMPLES)
        self.temp_data: Deque[float] = deque(maxlen=MAX_BUFFERED_SAMPLES)
        self.velocity_timestamps: Deque[float] = deque(maxlen=MAX_BUFFERED_SAMPLES)
        self.velocity_data: Deque[float] = deque(maxlen=MAX_BUFFERED_SAMPLES)

        self.value_labels: Dict[str, QLabel] = {}
        self.status_label: QLabel
        self.info_label: QLabel
        self.port_combo: QComboBox
        self.baud_spin: QSpinBox
        self.connect_button: QPushButton
        self.disconnect_button: QPushButton
        self.refresh_button: QPushButton
        self.velocity_axis_combo: QComboBox
        self.reset_velocity_button: QPushButton
        self.drift_suppression_checkbox: QCheckBox

        self.accel_plot: pg.PlotWidget
        self.gyro_plot: pg.PlotWidget
        self.velocity_plot: pg.PlotWidget
        self.accel_curves: Dict[str, pg.PlotDataItem] = {}
        self.gyro_curves: Dict[str, pg.PlotDataItem] = {}
        self.velocity_curve: pg.PlotDataItem

        self._build_ui()
        self._build_timers()
        self.refresh_ports()
        self._set_status("Disconnected.", "#666666")
        self._update_connection_controls()
        self._update_info_label()

    def _build_ui(self) -> None:
        central = QWidget()
        self.setCentralWidget(central)
        root_layout = QVBoxLayout(central)
        root_layout.setContentsMargins(12, 12, 12, 12)
        root_layout.setSpacing(10)

        controls_group = QGroupBox("Connection")
        controls_layout = QGridLayout(controls_group)

        self.port_combo = QComboBox()
        self.port_combo.setEditable(True)
        self.port_combo.setInsertPolicy(QComboBox.InsertPolicy.NoInsert)
        self.port_combo.setMinimumWidth(220)

        self.baud_spin = QSpinBox()
        self.baud_spin.setRange(300, 3000000)
        self.baud_spin.setValue(DEFAULT_BAUDRATE)
        self.baud_spin.setSingleStep(100)

        self.refresh_button = QPushButton("Refresh Ports")
        self.connect_button = QPushButton("Connect")
        self.disconnect_button = QPushButton("Disconnect")
        self.velocity_axis_combo = QComboBox()
        self.velocity_axis_combo.addItems(("X", "Y", "Z"))
        self.velocity_axis_combo.setCurrentText("Z")
        self.reset_velocity_button = QPushButton("Reset Velocity")
        self.drift_suppression_checkbox = QCheckBox("Drift Suppression")
        self.drift_suppression_checkbox.setChecked(True)

        self.refresh_button.clicked.connect(self.refresh_ports)
        self.connect_button.clicked.connect(self.connect_to_source)
        self.disconnect_button.clicked.connect(self.disconnect_from_source)
        self.velocity_axis_combo.currentTextChanged.connect(self.change_velocity_axis)
        self.reset_velocity_button.clicked.connect(self.reset_velocity)
        self.drift_suppression_checkbox.toggled.connect(self.toggle_drift_suppression)

        controls_layout.addWidget(QLabel("Port"), 0, 0)
        controls_layout.addWidget(self.port_combo, 0, 1)
        controls_layout.addWidget(QLabel("Baud"), 0, 2)
        controls_layout.addWidget(self.baud_spin, 0, 3)
        controls_layout.addWidget(self.refresh_button, 0, 4)
        controls_layout.addWidget(self.connect_button, 0, 5)
        controls_layout.addWidget(self.disconnect_button, 0, 6)

        controls_layout.addWidget(QLabel("Velocity Axis"), 1, 0)
        controls_layout.addWidget(self.velocity_axis_combo, 1, 1)
        controls_layout.addWidget(self.drift_suppression_checkbox, 1, 2, 1, 2)
        controls_layout.addWidget(self.reset_velocity_button, 1, 4, 1, 3)

        self.status_label = QLabel()
        self.status_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        controls_layout.addWidget(self.status_label, 2, 0, 1, 7)

        self.info_label = QLabel()
        self.info_label.setStyleSheet("color: #444444;")
        controls_layout.addWidget(self.info_label, 3, 0, 1, 7)

        root_layout.addWidget(controls_group)

        readouts_layout = QHBoxLayout()
        readouts_layout.setSpacing(10)
        readouts_layout.addWidget(
            self._create_value_group(
                "Accelerometer [g]",
                (("ax", "X"), ("ay", "Y"), ("az", "Z")),
            )
        )
        readouts_layout.addWidget(
            self._create_value_group(
                "Gyroscope [dps]",
                (("gx", "X"), ("gy", "Y"), ("gz", "Z")),
            )
        )
        readouts_layout.addWidget(
            self._create_value_group(
                "Temperature [C]",
                (("temp", "TEMP"),),
            )
        )
        readouts_layout.addWidget(
            self._create_value_group(
                "Motion Estimate",
                (
                    ("velocity", "VEL"),
                    ("lin_accel", "LINACC"),
                    ("pitch", "PITCH"),
                    ("roll", "ROLL"),
                ),
            )
        )
        root_layout.addLayout(readouts_layout)

        pg.setConfigOptions(antialias=True)
        pg.setConfigOption("background", "w")
        pg.setConfigOption("foreground", "#202020")

        self.accel_plot = self._create_plot_widget("Acceleration", "Acceleration (g)")
        self.gyro_plot = self._create_plot_widget("Gyroscope", "Angular Rate (dps)")
        self.velocity_plot = self._create_plot_widget("Velocity", "Velocity (m/s)")

        self.accel_curves = {
            "ax": self.accel_plot.plot(name="Accel X", pen=pg.mkPen("#d62728", width=2)),
            "ay": self.accel_plot.plot(name="Accel Y", pen=pg.mkPen("#2ca02c", width=2)),
            "az": self.accel_plot.plot(name="Accel Z", pen=pg.mkPen("#1f77b4", width=2)),
        }
        self.gyro_curves = {
            "gx": self.gyro_plot.plot(name="Gyro X", pen=pg.mkPen("#d62728", width=2)),
            "gy": self.gyro_plot.plot(name="Gyro Y", pen=pg.mkPen("#2ca02c", width=2)),
            "gz": self.gyro_plot.plot(name="Gyro Z", pen=pg.mkPen("#1f77b4", width=2)),
        }
        self.velocity_curve = self.velocity_plot.plot(
            name="Velocity",
            pen=pg.mkPen("#9467bd", width=2),
        )

        root_layout.addWidget(self.accel_plot, stretch=1)
        root_layout.addWidget(self.gyro_plot, stretch=1)
        root_layout.addWidget(self.velocity_plot, stretch=1)

    def _build_timers(self) -> None:
        self.poll_timer = QTimer(self)
        self.poll_timer.setInterval(POLL_INTERVAL_MS)
        self.poll_timer.timeout.connect(self.poll_data_source)

        self.ui_timer = QTimer(self)
        self.ui_timer.setInterval(UI_REFRESH_INTERVAL_MS)
        self.ui_timer.timeout.connect(self.refresh_live_view)

    def _create_value_group(
        self,
        title: str,
        items: Tuple[Tuple[str, str], ...],
    ) -> QGroupBox:
        group = QGroupBox(title)
        layout = QGridLayout(group)

        label_font = QFont()
        label_font.setPointSize(11)

        value_font = QFont("Consolas")
        value_font.setPointSize(20)
        value_font.setBold(True)

        for row, (key, display_label) in enumerate(items):
            axis_label = QLabel(display_label)
            axis_label.setFont(label_font)

            value_label = QLabel("--")
            value_label.setFont(value_font)
            value_label.setAlignment(
                Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter
            )
            value_label.setMinimumWidth(140)

            self.value_labels[key] = value_label

            layout.addWidget(axis_label, row, 0)
            layout.addWidget(value_label, row, 1)

        return group

    def _create_plot_widget(self, title: str, y_label: str) -> pg.PlotWidget:
        plot = pg.PlotWidget(title=title)
        plot.addLegend(offset=(10, 10))
        plot.showGrid(x=True, y=True, alpha=0.25)
        plot.setLabel("bottom", "Time", units="s")
        plot.setLabel("left", y_label)
        plot.setClipToView(True)
        plot.setDownsampling(auto=True, mode="peak")
        return plot

    def refresh_ports(self) -> None:
        previous_text = self.port_combo.currentText().strip()
        port_names = SerialImuSource.list_ports()

        self.port_combo.blockSignals(True)
        self.port_combo.clear()
        self.port_combo.addItems(port_names)
        self.port_combo.blockSignals(False)

        if previous_text:
            index = self.port_combo.findText(previous_text)
            if index >= 0:
                self.port_combo.setCurrentIndex(index)
            else:
                self.port_combo.setEditText(previous_text)
        else:
            self.port_combo.setCurrentText(SIMULATED_PORT_NAME)

    def connect_to_source(self) -> None:
        port_name = self.port_combo.currentText().strip()
        baud_rate = int(self.baud_spin.value())

        if port_name.upper() == SIMULATED_PORT_NAME:
            source: ImuSource = SimulatedImuSource()
        else:
            source = SerialImuSource()

        success, message = source.connect(port_name, baud_rate)
        if not success:
            self.source = None
            self._set_status(message, "#b00020")
            self._update_connection_controls()
            self._update_info_label()
            return

        self.source = source
        self._clear_history()
        self.motion_estimator.set_axis(self.velocity_axis_combo.currentText())
        self.motion_estimator.reset()
        self._reset_live_readouts()
        self._set_status(message, "#146c2e")
        self._update_connection_controls()
        self._update_info_label()
        self.poll_timer.start()
        self.ui_timer.start()

    def disconnect_from_source(self) -> None:
        self.poll_timer.stop()
        self.ui_timer.stop()

        if self.source is not None:
            self.source.disconnect()
        self.source = None

        self._set_status("Disconnected.", "#666666")
        self._update_connection_controls()
        self._update_info_label()

    def poll_data_source(self) -> None:
        if self.source is None:
            return

        samples, error_message = self.source.poll()
        if error_message:
            self.source.disconnect()
            self.source = None
            self.poll_timer.stop()
            self.ui_timer.stop()
            self._set_status(error_message, "#b00020")
            self._update_connection_controls()
            self._update_info_label()
            return

        if not samples:
            self._update_info_label()
            return

        for sample in samples:
            self._append_sample(sample)

        self.latest_sample = samples[-1]
        self._trim_history(self.latest_sample.timestamp)
        self._update_info_label()

    def change_velocity_axis(self, axis: str) -> None:
        self.motion_estimator.set_axis(axis)
        self.reset_velocity()

    def toggle_drift_suppression(self, enabled: bool) -> None:
        self.motion_estimator.set_drift_suppression_enabled(enabled)
        self._update_info_label()

    def reset_velocity(self) -> None:
        self.motion_estimator.reset(self.latest_sample)
        self.velocity_timestamps.clear()
        self.velocity_data.clear()
        self.velocity_curve.setData([], [])

        if self.latest_motion_estimate is not None:
            self.latest_motion_estimate.velocity_mps = 0.0
            self.latest_motion_estimate.linear_accel_axis_mps2 = 0.0
            self.latest_motion_estimate.stationary = True

        self.value_labels["velocity"].setText("0.000")
        self.value_labels["lin_accel"].setText("0.000")
        self._update_info_label()

    def refresh_live_view(self) -> None:
        self._refresh_value_labels()
        self._refresh_plots()

    def _append_sample(self, sample: ImuSample) -> None:
        self.timestamps.append(sample.timestamp)
        self.ax_data.append(sample.ax)
        self.ay_data.append(sample.ay)
        self.az_data.append(sample.az)
        self.gx_data.append(sample.gx)
        self.gy_data.append(sample.gy)
        self.gz_data.append(sample.gz)
        self.temp_data.append(sample.temp)

        self.latest_motion_estimate = self.motion_estimator.update(sample)
        self.velocity_timestamps.append(sample.timestamp)
        self.velocity_data.append(self.latest_motion_estimate.velocity_mps)

    def _trim_history(self, current_time: float) -> None:
        while self.timestamps and (current_time - self.timestamps[0]) > self.history_seconds:
            self.timestamps.popleft()
            self.ax_data.popleft()
            self.ay_data.popleft()
            self.az_data.popleft()
            self.gx_data.popleft()
            self.gy_data.popleft()
            self.gz_data.popleft()
            self.temp_data.popleft()

        while self.velocity_timestamps and (
            current_time - self.velocity_timestamps[0]
        ) > self.history_seconds:
            self.velocity_timestamps.popleft()
            self.velocity_data.popleft()

    def _refresh_value_labels(self) -> None:
        if self.latest_sample is not None:
            self.value_labels["ax"].setText(f"{self.latest_sample.ax:+0.3f}")
            self.value_labels["ay"].setText(f"{self.latest_sample.ay:+0.3f}")
            self.value_labels["az"].setText(f"{self.latest_sample.az:+0.3f}")
            self.value_labels["gx"].setText(f"{self.latest_sample.gx:+0.2f}")
            self.value_labels["gy"].setText(f"{self.latest_sample.gy:+0.2f}")
            self.value_labels["gz"].setText(f"{self.latest_sample.gz:+0.2f}")
            self.value_labels["temp"].setText(f"{self.latest_sample.temp:0.2f}")

        if self.latest_motion_estimate is not None:
            self.value_labels["velocity"].setText(
                f"{self.latest_motion_estimate.velocity_mps:+0.3f}"
            )
            self.value_labels["lin_accel"].setText(
                f"{self.latest_motion_estimate.linear_accel_axis_mps2:+0.3f}"
            )
            self.value_labels["pitch"].setText(
                f"{self.latest_motion_estimate.pitch_deg:+0.1f}"
            )
            self.value_labels["roll"].setText(
                f"{self.latest_motion_estimate.roll_deg:+0.1f}"
            )

    def _refresh_plots(self) -> None:
        accel_times = list(self.timestamps)
        velocity_times = list(self.velocity_timestamps)

        if accel_times:
            self.accel_curves["ax"].setData(accel_times, list(self.ax_data))
            self.accel_curves["ay"].setData(accel_times, list(self.ay_data))
            self.accel_curves["az"].setData(accel_times, list(self.az_data))
            self.gyro_curves["gx"].setData(accel_times, list(self.gx_data))
            self.gyro_curves["gy"].setData(accel_times, list(self.gy_data))
            self.gyro_curves["gz"].setData(accel_times, list(self.gz_data))

        if velocity_times:
            self.velocity_curve.setData(velocity_times, list(self.velocity_data))

        if not accel_times and not velocity_times:
            return

        x_candidates = []
        if accel_times:
            x_candidates.append(accel_times[-1])
        if velocity_times:
            x_candidates.append(velocity_times[-1])

        x_max = max(x_candidates)
        x_min = max(0.0, x_max - self.history_seconds)
        self.accel_plot.setXRange(x_min, x_max, padding=0.02)
        self.gyro_plot.setXRange(x_min, x_max, padding=0.02)
        self.velocity_plot.setXRange(x_min, x_max, padding=0.02)

    def _set_status(self, text: str, color: str) -> None:
        self.status_label.setText(text)
        self.status_label.setStyleSheet(
            f"padding: 6px 10px; border: 1px solid {color}; "
            f"border-radius: 4px; color: {color}; background: #fafafa;"
        )

    def _update_info_label(self) -> None:
        source_name = self.source.connected_name if self.source is not None else "None"
        good_lines = self.source.good_lines if self.source is not None else 0
        bad_lines = self.source.bad_lines if self.source is not None else 0
        drift_label = "On" if self.drift_suppression_checkbox.isChecked() else "Off"
        stationary_label = (
            "Yes"
            if self.latest_motion_estimate is not None and self.latest_motion_estimate.stationary
            else "No"
        )

        self.info_label.setText(
            f"Source: {source_name} | Good lines: {good_lines} | "
            f"Malformed lines ignored: {bad_lines} | "
            f"Velocity axis: {self.velocity_axis_combo.currentText()} | "
            f"Drift suppression: {drift_label} | "
            f"Stationary: {stationary_label} | "
            f"Buffered samples: {len(self.timestamps)} | "
            f"History: {self.history_seconds:.0f}s"
        )

    def _update_connection_controls(self) -> None:
        connected = self.source is not None and self.source.is_connected
        self.connect_button.setEnabled(not connected)
        self.disconnect_button.setEnabled(connected)
        self.port_combo.setEnabled(not connected)
        self.baud_spin.setEnabled(not connected)
        self.refresh_button.setEnabled(not connected)

    def _clear_history(self) -> None:
        self.timestamps.clear()
        self.ax_data.clear()
        self.ay_data.clear()
        self.az_data.clear()
        self.gx_data.clear()
        self.gy_data.clear()
        self.gz_data.clear()
        self.temp_data.clear()
        self.velocity_timestamps.clear()
        self.velocity_data.clear()
        self.latest_sample = None
        self.latest_motion_estimate = None

        self.accel_curves["ax"].setData([], [])
        self.accel_curves["ay"].setData([], [])
        self.accel_curves["az"].setData([], [])
        self.gyro_curves["gx"].setData([], [])
        self.gyro_curves["gy"].setData([], [])
        self.gyro_curves["gz"].setData([], [])
        self.velocity_curve.setData([], [])

    def _reset_live_readouts(self) -> None:
        for key, label in self.value_labels.items():
            label.setText("0.000" if key in {"velocity", "lin_accel", "pitch", "roll"} else "--")

    def closeEvent(self, event) -> None:  # type: ignore[override]
        self.disconnect_from_source()
        super().closeEvent(event)


def main() -> int:
    app = QApplication(sys.argv)
    app.setStyle("Fusion")

    window = ImuViewerWindow()
    window.show()

    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
