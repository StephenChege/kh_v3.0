#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <esp_gap_ble_api.h>

// ============================================================================
// KEYHOLDER V3.0 — UNIFIED FIRMWARE
// Merge of V1.0 (manual LED/buzzer control) + V2.0 (RSSI reporting)
//
// Architecture note: proximity auto-control logic lives in the PWA, not here.
// This firmware is intentionally "dumb": it always accepts LED/buzzer writes
// and always reports RSSI. The PWA decides whether to drive LED/buzzer from
// manual sliders or from a proximity calculation — see pwa/src/hooks/useBLE.js
// ============================================================================

// ============================================================================
// PIN DEFINITIONS
// ============================================================================
#define LED_PIN 18
#define BUZZER_PIN 19

// ============================================================================
// PWM CONFIGURATION
// ============================================================================
#define LED_PWM_CHANNEL 0
#define LED_PWM_FREQ 1000        // 1 kHz
#define LED_PWM_BITS 8           // 8-bit resolution (0-255)

#define BUZZER_PWM_CHANNEL 1
#define BUZZER_PWM_FREQ 2000     // 2 kHz
#define BUZZER_PWM_BITS 8        // 8-bit resolution (0-255)

// ============================================================================
// BLE CONFIGURATION
// (UUIDs match pwa_v2/src/hooks/useBLE.js exactly — do not change without
//  updating the PWA too)
// ============================================================================
#define SERVICE_UUID "12345678-1234-1234-1234-123456789abc"
#define LED_WRITE_UUID "deadbeef-1234-1234-1234-123456789abc"
#define BUZZER_WRITE_UUID "deadbeef-1234-1234-1234-123456789abd"
#define RSSI_CHARACTERISTIC_UUID "abcd1234-5678-1234-5678-abcdef123457"

// ============================================================================
// MEASUREMENT INTERVAL
// ============================================================================
#define MEASUREMENT_INTERVAL_MS 1000  // 1 second

// ============================================================================
// GLOBAL VARIABLES
// ============================================================================
BLECharacteristic *pLedCharacteristic;
BLECharacteristic *pBuzzerCharacteristic;
BLECharacteristic *pRSSICharacteristic;
BLEServer *pServer;
bool deviceConnected = false;
int currentRSSI = 0;              // Updated by GAP callback
unsigned long lastMeasurementTime = 0;
uint8_t connectedClientMAC[6];

// ============================================================================
// LOGGING
// ============================================================================
void logToSerial(const String &message) {
  unsigned long currentTime = millis();
  unsigned long seconds = currentTime / 1000;
  unsigned long millis_part = currentTime % 1000;

  String timestamp = "[" + String(seconds) + "." + String(millis_part) + "s] ";
  Serial.println(timestamp + message);
}

// ============================================================================
// PWM INITIALIZATION
// ============================================================================
void initializePWM() {
  // LED PWM
  ledcSetup(LED_PWM_CHANNEL, LED_PWM_FREQ, LED_PWM_BITS);
  ledcAttachPin(LED_PIN, LED_PWM_CHANNEL);
  ledcWrite(LED_PWM_CHANNEL, 0);

  // Buzzer PWM
  ledcSetup(BUZZER_PWM_CHANNEL, BUZZER_PWM_FREQ, BUZZER_PWM_BITS);
  ledcAttachPin(BUZZER_PIN, BUZZER_PWM_CHANNEL);
  ledcWrite(BUZZER_PWM_CHANNEL, 0);

  logToSerial("PWM initialized: LED on pin " + String(LED_PIN) + ", Buzzer on pin " + String(BUZZER_PIN));
}

// ============================================================================
// UPDATE RSSI CHARACTERISTIC
// Encodes RSSI as a 2-byte little-endian signed integer, matching
// pwa_v2/src/hooks/useBLE.js's `view.getInt16(0, true)` read.
// ============================================================================
void updateRSSICharacteristic(int rssi) {
  uint8_t rssiBytes[2];
  rssiBytes[0] = rssi & 0xFF;           // Low byte
  rssiBytes[1] = (rssi >> 8) & 0xFF;    // High byte

  pRSSICharacteristic->setValue(rssiBytes, 2);
  pRSSICharacteristic->notify();
}

// ============================================================================
// GAP EVENT CALLBACK - Captures RSSI when available
// ============================================================================
static void ble_gap_event_callback(esp_gap_ble_cb_event_t event, esp_ble_gap_cb_param_t *param) {
  switch (event) {
    case ESP_GAP_BLE_READ_RSSI_COMPLETE_EVT:
      currentRSSI = param->read_rssi_cmpl.rssi;
      break;
    default:
      break;
  }
}

// ============================================================================
// READ RSSI FROM CONNECTED CLIENT
// ============================================================================
int readRSSI() {
  if (!deviceConnected) return 0;

  // Request RSSI read (result comes back in ble_gap_event_callback)
  esp_ble_gap_read_rssi(connectedClientMAC);

  // Return the last measured RSSI (from previous callback)
  return currentRSSI;
}

// ============================================================================
// BLE CHARACTERISTIC CALLBACKS - LED BRIGHTNESS
// Always applies the written value. Whether this value came from a manual
// slider or a proximity calculation is a PWA-side decision.
// ============================================================================
class LedCharacteristicCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    std::string valueStr = pCharacteristic->getValue();

    if (valueStr.length() >= 1) {
      uint8_t brightness = (uint8_t)valueStr[0];
      ledcWrite(LED_PWM_CHANNEL, brightness);
      logToSerial("LED brightness set to: " + String(brightness) + "/255");
    }
  }
};

// ============================================================================
// BLE CHARACTERISTIC CALLBACKS - BUZZER VOLUME
// ============================================================================
class BuzzerCharacteristicCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    std::string valueStr = pCharacteristic->getValue();

    if (valueStr.length() >= 1) {
      uint8_t volume = (uint8_t)valueStr[0];
      ledcWrite(BUZZER_PWM_CHANNEL, volume);
      logToSerial("Buzzer volume set to: " + String(volume) + "/255");
    }
  }
};

// ============================================================================
// BLE SERVER CALLBACKS
// ============================================================================
class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *pServer, esp_ble_gatts_cb_param_t *param) {
    deviceConnected = true;

    memcpy(connectedClientMAC, param->connect.remote_bda, 6);

    String macStr = "";
    for (int i = 0; i < 6; i++) {
      if (i > 0) macStr += ":";
      if (connectedClientMAC[i] < 0x10) macStr += "0";
      macStr += String(connectedClientMAC[i], HEX);
    }

    logToSerial("Phone connected! MAC: " + macStr);
    lastMeasurementTime = millis();
  }

  void onDisconnect(BLEServer *pServer) {
    deviceConnected = false;
    ledcWrite(LED_PWM_CHANNEL, 0);
    ledcWrite(BUZZER_PWM_CHANNEL, 0);
    logToSerial("Phone disconnected. LED and buzzer turned off.");

    // Restart advertising so the device is discoverable again without a
    // manual reset. BLEDevice::getAdvertising() returns the same singleton
    // set up in setup(), so no need to pass pAdvertising around.
    BLEDevice::getAdvertising()->start();
    logToSerial("Advertising restarted.");
  }
};

// ============================================================================
// SETUP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  logToSerial("===========================================");
  logToSerial("Keyholder V3.0 — Unified Firmware");
  logToSerial("===========================================");

  initializePWM();

  BLEDevice::init("ESP32_Proximity");
  esp_ble_gap_register_callback(ble_gap_event_callback);
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  // LED WRITE characteristic (from V1.0)
  pLedCharacteristic = pService->createCharacteristic(
    LED_WRITE_UUID,
    BLECharacteristic::PROPERTY_WRITE
  );
  pLedCharacteristic->setCallbacks(new LedCharacteristicCallbacks());

  // Buzzer WRITE characteristic (from V1.0)
  pBuzzerCharacteristic = pService->createCharacteristic(
    BUZZER_WRITE_UUID,
    BLECharacteristic::PROPERTY_WRITE
  );
  pBuzzerCharacteristic->setCallbacks(new BuzzerCharacteristicCallbacks());

  // RSSI READ/NOTIFY characteristic (from V2.0)
  pRSSICharacteristic = pService->createCharacteristic(
    RSSI_CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  pRSSICharacteristic->addDescriptor(new BLE2902());
  uint8_t rssiInitial[2] = {0x00, 0x00};
  pRSSICharacteristic->setValue(rssiInitial, 2);

  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMaxPreferred(0x12);
  pAdvertising->start();

  logToSerial("BLE initialized");
  logToSerial("Service UUID: " + String(SERVICE_UUID));
  logToSerial("LED Write UUID: " + String(LED_WRITE_UUID));
  logToSerial("Buzzer Write UUID: " + String(BUZZER_WRITE_UUID));
  logToSerial("RSSI Characteristic UUID: " + String(RSSI_CHARACTERISTIC_UUID));
  logToSerial("Waiting for connection...");
}

// ============================================================================
// MAIN LOOP
// Always reports RSSI on a 1-second interval while connected. Does NOT
// auto-drive LED/buzzer from RSSI — that decision lives in the PWA.
// ============================================================================
void loop() {
  if (deviceConnected) {
    unsigned long currentTime = millis();

    if (currentTime - lastMeasurementTime >= MEASUREMENT_INTERVAL_MS) {
      lastMeasurementTime = currentTime;

      int rssi = readRSSI();

      if (rssi != 0) {
        updateRSSICharacteristic(rssi);
      }
    }
  }

  delay(100);
}
