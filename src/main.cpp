#include <Arduino.h>
#include <Wire.h>
#include <SparkFunLSM6DS3.h>

LSM6DS3 imu(I2C_MODE, 0x6A);

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(10);
  delay(500);

  Wire.begin(8, 9);

  if (imu.begin() != 0) {
    Serial.println("IMU init failed. Check wiring.");
    while (1);
  }
  Serial.println("IMU ready!");
}

void loop() {
  Serial.printf("%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%.2f\n",
    imu.readFloatAccelX(), imu.readFloatAccelY(), imu.readFloatAccelZ(),
    imu.readFloatGyroX(),  imu.readFloatGyroY(),  imu.readFloatGyroZ(),
    imu.readTempC()
  );
  delay(100);
}