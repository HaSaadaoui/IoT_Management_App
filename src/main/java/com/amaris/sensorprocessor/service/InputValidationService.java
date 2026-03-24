package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.constant.Constants;
import com.amaris.sensorprocessor.constant.FrequencyPlan;
import com.amaris.sensorprocessor.entity.Gateway;
import com.amaris.sensorprocessor.exception.CustomException;
import com.amaris.sensorprocessor.util.LoggerUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.validation.BindingResult;

import java.util.Arrays;
@Service
public class InputValidationService {

    private final Logger logger = LoggerFactory.getLogger(this.getClass());

    public void isValidInputGatewayId(String gatewayId, BindingResult bindingResult) {
        if (gatewayId == null || !gatewayId.matches("^(?!-)(?!.*--)[a-z0-9-]{3,36}(?<!-)$")) {
            LoggerUtil.logWithBindingObject(bindingResult, Constants.GATEWAY_ID_INVALID, gatewayId, Constants.BINDING_GATEWAY_ID);
        }
    }

    public void isValidInputGatewayEui(String gatewayEui, BindingResult bindingResult) {
        if (gatewayEui == null || !gatewayEui.matches("^[0-9A-F]{16}$")) {
            LoggerUtil.logWithBindingObject(bindingResult, Constants.GATEWAY_EUI_INVALID, gatewayEui, Constants.BINDING_GATEWAY_EUI);
        }
    }

    public void isValidInputIpAddress(String ipAddress, BindingResult bindingResult) {
        if (ipAddress == null || !ipAddress.matches("^((25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)\\.){3}(25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)$")) {
            LoggerUtil.logWithBindingObject(bindingResult, Constants.GATEWAY_IP_INVALID, ipAddress, Constants.BINDING_IP_ADDRESS);
        }
    }

    public void isValidDropDownMenuFrequencyPlan(Gateway gateway, BindingResult bindingResult) {
        if (gateway.getFrequencyPlan() != null) {
            boolean exists = Arrays.stream(FrequencyPlan.values())
                    .anyMatch(value -> value.getDescription().equals(gateway.getFrequencyPlan()));
            if (!exists) {
                gateway.setFrequencyPlan(null);
                LoggerUtil.logWithBindingObject(bindingResult, Constants.GATEWAY_FREQUENCY_PLAN_INVALID, gateway.getFrequencyPlan(), Constants.BINDING_FREQUENCY_PLAN);
            }
        }
    }

    public void isValidInputBuildingId(Integer buildingId, BindingResult bindingResult) {
        if (buildingId == null || buildingId <= 0) {
            LoggerUtil.logWithBindingObject(bindingResult, Constants.GATEWAY_BUILDING_NAME_INVALID,
                    String.valueOf(buildingId), Constants.BINDING_BUILDING_NAME);
        }
    }

    public void isValidProtocolId(Integer protocolId, BindingResult bindingResult) {
        if (protocolId == null || protocolId <= 0) {
            LoggerUtil.logWithBindingObject(
                    bindingResult,
                    Constants.GATEWAY_PROTOCOL_ID_INVALID,
                    String.valueOf(protocolId),
                    "protocolId"
            );
        }
    }


    public void isValidInputFloorNumber(Integer floorNumber, BindingResult bindingResult) {
        if (floorNumber == null || floorNumber < -10 || floorNumber > 99) {
            String gatewayValue = "Floor number : " + floorNumber;
            LoggerUtil.logWithBindingObject(bindingResult, Constants.GATEWAY_FLOOR_NUMBER_INVALID, gatewayValue, Constants.BINDING_FLOOR_NUMBER);
        }
    }

    public void isValidInputAntenna(Double coordinate) {
        if (coordinate == null || !(String.valueOf(coordinate).matches("^\\d{1,3}(\\.\\d{1,10})?$"))) {
            logger.error("Unauthorized format : coordinate invalid");
            System.out.println("\u001B[31m" + "Unauthorized format : coordinate invalid" + "\u001B[0m");
            throw new CustomException("Unauthorized format : coordinate field");
        }
    }

    public void validateGatewayForCreateForm(Gateway gateway, BindingResult bindingResult) {
        isValidInputGatewayId(gateway.getGatewayId(), bindingResult);
        isValidInputGatewayEui(gateway.getGatewayEui(), bindingResult);
        isValidInputIpAddress(gateway.getIpAddress(), bindingResult);
        isValidDropDownMenuFrequencyPlan(gateway, bindingResult);
        isValidInputBuildingId(gateway.getBuildingId(), bindingResult);
        isValidProtocolId(gateway.getProtocolId(), bindingResult);
        isValidInputFloorNumber(gateway.getFloorNumber(), bindingResult);
    }

    public void validateGatewayForUpdateForm(Gateway gateway, BindingResult bindingResult) {
        isValidInputGatewayId(gateway.getGatewayId(), bindingResult);
        isValidInputIpAddress(gateway.getIpAddress(), bindingResult);
        isValidDropDownMenuFrequencyPlan(gateway, bindingResult);
        isValidProtocolId(gateway.getProtocolId(), bindingResult);
        isValidInputBuildingId(gateway.getBuildingId(), bindingResult);
        isValidInputFloorNumber(gateway.getFloorNumber(), bindingResult);
    }
}