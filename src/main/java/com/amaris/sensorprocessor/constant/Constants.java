package com.amaris.sensorprocessor.constant;

public final class Constants {

    private Constants() {}

    /**
     * Label d'erreur qui s'affichera dans la popup
     */
    public static final String INPUT_ERROR = "Input error in the form";
    public static final String GATEWAY_ID_EXISTS = "Gateway ID already exists";
    public static final String GATEWAY_EUI_EXISTS = "Gateway EUI already exists";
    public static final String LORAWAN_PROBLEM = "Lorawan server problem";
    public static final String DATABASE_PROBLEM = "Database problem";
    public static final String GATEWAY_NOT_FOUND = "Gateway ID not found";
    public static final String SENSOR_NOT_FOUND = "Sensor ID not found";
    public static final String PERMISSION_DENIED = "Permission user denied";
    public static final String GATEWAY_PROBLEM = "Problem with this gateway";
    public static final String GATEWAY_DONT_EXISTS = "Gateway don't exists";
    public static final String GATEWAY_ID_INVALID = "Gateway ID format is invalid";
    public static final String GATEWAY_EUI_INVALID = "Gateway EUI format is invalid";
    public static final String GATEWAY_IP_INVALID = "IP Address format is invalid";
    public static final String GATEWAY_FREQUENCY_PLAN_INVALID = "Frequency Plan format is invalid";
    public static final String GATEWAY_BUILDING_NAME_INVALID = "Text format of Building Name is invalid";
    public static final String GATEWAY_FLOOR_NUMBER_INVALID = "Text format of Floor Number is invalid";
    public static final String GATEWAY_LOCATION_INVALID = "Text format of Location Description is invalid";

    /**
     * Noms de l'erreur à remonter dans le BindingResult
     */
    public static final String BINDING_GATEWAY_ID = "gatewayId";
    public static final String BINDING_GATEWAY_EUI = "gatewayEui";
    public static final String BINDING_LORAWAN_PROBLEM = "LorawanProblem";
    public static final String BINDING_PERMISSION_DENIED = "permissionDenied";
    public static final String BINDING_GATEWAY_PROBLEM = "gatewayProblem";
    public static final String BINDING_DATABASE_PROBLEM = "DatabaseProblem";
    public static final String BINDING_IP_ADDRESS = "ipAddress";
    public static final String BINDING_FREQUENCY_PLAN = "frequencyPlan";
    public static final String BINDING_BUILDING_NAME = "buildingName";
    public static final String BINDING_FLOOR_NUMBER = "floorNumber";
    public static final String BINDING_LOCATION = "locationDescription";

    /**
     * Noms de l'objet BindingResult correspondant au formulaire en question
     */
    public static final String BINDING_GATEWAY_ADD = "org.springframework.validation.BindingResult.gatewayAdd";
    public static final String BINDING_GATEWAY_EDIT = "org.springframework.validation.BindingResult.gatewayEdit";

    /**
     * Noms des pages html
     */
    public static final String PAGE_MANAGE_GATEWAYS = "manageGateways";
    public static final String PAGE_MONITORING_GATEWAYS = "monitoringGateway";
    public static final String PAGE_MANAGE_SENSORS = "manageSensors";


    /* ===== Messages (Sensors) ===== */
    public static final String SENSOR_ID_EXISTS   = "Sensor ID already exists";
    public static final String SENSOR_ID_INVALID  = "Sensor ID format is invalid";
    public static final String SENSOR_PROBLEM     = "Problem with this sensor";

    /* ===== Noms de champs pour BindingResult (Sensors) ===== */
    /* IMPORTANT: ils doivent correspondre EXACTEMENT aux noms des propriétés du bean Sensor */
    public static final String BINDING_SENSOR_ID             = "idSensor";          // <-- corriger ici
    public static final String BINDING_DEVICE_TYPE           = "deviceType";
    public static final String BINDING_COMMISSIONING_DATE    = "commissioningDate";
    public static final String BINDING_STATUS                = "status";
    public static final String BINDING_SENSOR_BUILDING_NAME  = "buildingName";
    public static final String BINDING_SENSOR_FLOOR          = "floor";
    public static final String BINDING_SENSOR_LOCATION       = "location";
    public static final String BINDING_GATEWAY_ID_FK         = "idGateway";

    /* ===== Noms de l'objet BindingResult pour les formulaires Sensors ===== */
    /* Doivent matcher les th:object utilisés dans la page: sensorAdd / sensorEdit */
    public static final String BINDING_SENSOR_ADD  = "org.springframework.validation.BindingResult.sensorAdd";
    public static final String BINDING_SENSOR_EDIT = "org.springframework.validation.BindingResult.sensorEdit";

    /* 
     * Paramètres de la synchronisation des métriques capteurs (SensorData)
     * Contexte: TTN stocke temporairement en ligne des données jusqu'à plusieurs jours.
     * Elles peuvent être récupéré sans avoir à les "attraper" au moment
     * meme où elles sont générées.
     */
    public static final Integer SENSOR_DATA_SYNC_PERIOD_MINUTE = 5; // Executer la synchro toutes les 15 minutes

    /*
     * Récupérer les données sur une plage plus longue que la période de synchro afin ne pas en rater aucune données
     */
    public static final Integer SENSOR_DATA_SYNC_ROLLBACK_TIME_MINUTE = SENSOR_DATA_SYNC_PERIOD_MINUTE * 2;

}
