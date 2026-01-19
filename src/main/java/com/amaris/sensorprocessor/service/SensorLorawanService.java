package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.LorawanSensorData;
import com.amaris.sensorprocessor.entity.Sensor;
import com.amaris.sensorprocessor.repository.SensorLorawanDao;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
@Slf4j
@Service
@RequiredArgsConstructor
public class SensorLorawanService {

    private final SensorLorawanDao sensorLorawanDao;

    private static final String CLUSTER = "eu1.cloud.thethings.network";
    private static final String LORAWAN_VERSION = "1.0.3";
    private static final String LORAWAN_PHY_VERSION = "1.0.3-a";

    /**
     * Mapper les gateways aux applications TTN
     * Basé sur la logique de Gateway_Monitoring_Api
     */
    private String getApplicationIdForGateway(String gatewayId) {
        if (gatewayId == null) return null;

        String g = gatewayId.trim().toLowerCase();

        if (g.endsWith("-appli") || g.endsWith("-app")) {
            return g;
        }

        return switch (g) {
            case "rpi-mantu" -> "rpi-mantu-appli";
            case "leva-rpi-mantu" -> "lorawan-network-mantu";
            case "lil-rpi-mantu" -> "lil-rpi-mantu-appli";
            default -> g + "-appli";
        };
    }


    public void createDevice(String idGateway, LorawanSensorData body) {
        String applicationId = getApplicationIdForGateway(idGateway);
        sensorLorawanDao.insertSensorInLorawan(applicationId, body);
        log.info("[LoRaWAN] created end-device in application {}", applicationId);
    }

    public void deleteDevice(String idGateway, String sensorId) {
        String applicationId = getApplicationIdForGateway(idGateway);
        sensorLorawanDao.deleteSensorInLorawan(applicationId, sensorId);
        log.info("[LoRaWAN] deleted end-device {} in application {}", sensorId, applicationId);
    }

    public void updateDevice(String idGateway, String sensorId, LorawanSensorData body) {
        String applicationId = getApplicationIdForGateway(idGateway);
        sensorLorawanDao.updateSensorInLorawan(applicationId, sensorId, body);
        log.info("[LoRaWAN] updated end-device {} in application {}", sensorId, applicationId);
    }

    /**
     * Récupère tous les devices d'une gateway depuis TTN
     * @param idGateway ID de la gateway
     * @return JSON avec la liste des devices
     */
    public String fetchDevicesForGateway(String idGateway) {
        String applicationId = getApplicationIdForGateway(idGateway);
        String devicesJson = sensorLorawanDao.fetchDevicesFromTTN(applicationId);
        log.info("[LoRaWAN] fetched devices for gateway {} (app: {})", idGateway, applicationId);
        return devicesJson;
    }

    public LorawanSensorData toLorawanCreate(Sensor s) {
        if (isBlank(s.getIdSensor())) throw new IllegalArgumentException("idSensor is required");
        if (isBlank(s.getDevEui()))   throw new IllegalArgumentException("devEui is required");
        if (isBlank(s.getJoinEui()))  throw new IllegalArgumentException("joinEui is required");
        if (isBlank(s.getAppKey()))   throw new IllegalArgumentException("appKey is required");

        LorawanSensorData.Ids ids = new LorawanSensorData.Ids();
        ids.setDeviceId(s.getIdSensor());
        ids.setDevEui(s.getDevEui());
        ids.setJoinEui(s.getJoinEui());

        LorawanSensorData.Key appKeyObj = new LorawanSensorData.Key();
        appKeyObj.setKey(s.getAppKey());

        LorawanSensorData.RootKeys rootKeys = new LorawanSensorData.RootKeys();
        rootKeys.setAppKey(appKeyObj);

        LorawanSensorData.EndDevice ed = new LorawanSensorData.EndDevice();
        ed.setIds(ids);
        ed.setSupportsJoin(true);
        ed.setNetworkServerAddress(CLUSTER);
        ed.setApplicationServerAddress(CLUSTER);
        ed.setJoinServerAddress(CLUSTER);
        ed.setLorawanVersion(LORAWAN_VERSION);
        ed.setLorawanPhyVersion(LORAWAN_PHY_VERSION);
        ed.setRootKeys(rootKeys);
        ed.setName(s.getIdSensor());

        LorawanSensorData dto = new LorawanSensorData();
        dto.setEndDevice(ed);
        return dto;
    }

    private static boolean isBlank(String v) {
        return v == null || v.trim().isEmpty();
    }
}
