-- Ce document est utilisé pour initialiser la BDD de test

PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS "Signal";
DROP TABLE IF EXISTS "Data_pirlight";
DROP TABLE IF EXISTS "Data_emsdesk";
DROP TABLE IF EXISTS "Sensors";
DROP TABLE IF EXISTS "Gateways";
DROP TABLE IF EXISTS "Users";

-- Création de la table Gateways
CREATE TABLE IF NOT EXISTS "Gateways" (
    gateway_id VARCHAR(50) PRIMARY KEY NOT NULL,
    gateway_eui VARCHAR(50) NOT NULL,
    ip_address VARCHAR(50) NOT NULL,
    frequency_plan VARCHAR(50) NOT NULL,
    created_at DATETIME NOT NULL,
    building_name VARCHAR(50) NOT NULL,
    floor_number INTEGER NOT NULL,
    location_description VARCHAR(50) NULL,
    antenna_latitude REAL NULL,
    antenna_longitude REAL NULL,
    antenna_altitude REAL NULL
);

-- Insertion des valeurs dans la table Gateways
INSERT INTO "Gateways" (gateway_id, gateway_eui, ip_address, frequency_plan, created_at, building_name, floor_number, location_description, antenna_latitude, antenna_longitude, antenna_altitude) VALUES
('gateway-001', '4446C001F55527AB', '192.168.1.10', 'EU_863_870_TTN', '2023-01-01', 'Batiment A', 1, 'Open space A', NULL, NULL, NULL),
('gateway-002', '4254C001F75641AA', '192.168.1.11', 'EU_863_870_TTN', '2023-02-01', 'Batiment B', 2, 'Bureau 202', NULL, NULL, NULL),
('gateway-003', '0016C333F98761BA', '192.168.1.12', 'EU_863_870_TTN', '2023-03-01', 'Batiment A', 3, 'Open space F', NULL, NULL, NULL),
('gateway-004', '3316C001F99927AB', '192.168.1.13', 'US_902_928_FSB_2', '2023-04-01', 'Batiment C', 1, 'Bureau 104', NULL, NULL, NULL),
('gateway-005', '4416C005F16747DB', '192.168.1.14', 'AS_920_923', '2023-05-01', 'Batiment D', 2, 'Bureau 205', NULL, NULL, NULL),
('gateway-006', '0016C661F10333BA', '192.168.1.15', 'US_902_928_FSB_2', '2023-06-01', 'Batiment A', 1, 'Open space K', NULL, NULL, NULL),
('gateway-007', '2216C441F16727CB', '192.168.1.16', 'AU_915_928_FSB_2', '2023-07-01', 'Batiment B', 2, 'Bureau 206', NULL, NULL, NULL),
('gateway-008', '0016C441F10534BA', '192.168.1.17', 'AU_915_928_FSB_2', '2023-08-01', 'Batiment A', 3, 'Bureau 306', NULL, NULL, NULL),
('gateway-009', '0321C001F44427AA', '192.168.1.18', 'CN_470_510_FSB_11', '2023-09-01', 'Batiment C', 1, 'Open space T', NULL, NULL, NULL),
('gateway-010', '0016C021F10543AB', '192.168.1.19', 'EU_863_870_TTN', '2023-10-01', 'Batiment A', 2, 'Open space U', NULL, NULL, NULL),
('leva-rpi-mantu', '0016C001F10527BB', '10.243.129.10', 'EU_863_870_TTN', '2025-04-14', 'Batiment Z', 3, 'Bureau 333', NULL, NULL, NULL),
('rpi-mantu', '0016C001F1054209', '10.243.129.10', 'EU_863_870_TTN', '2024-07-25', 'Batiment Z', 3, 'Bureau 333', NULL, NULL, NULL);

-- Création de la table Sensors
CREATE TABLE IF NOT EXISTS "Sensors" (
    id_sensor         VARCHAR(50) PRIMARY KEY NOT NULL,
    device_type       VARCHAR(50) NOT NULL,
    commissioning_date DATE      NOT NULL,
    status            BOOLEAN    NOT NULL,
    building_name     VARCHAR(100) NOT NULL,
    floor             INTEGER    NOT NULL,
    location          VARCHAR(50) NULL,
    id_gateway        VARCHAR(50) NULL,
    dev_eui           TEXT       NULL,
    join_eui          TEXT       NULL,
    app_key           TEXT       NULL,
    frequency_plan    VARCHAR(50) NULL,
    FOREIGN KEY (id_gateway) REFERENCES Gateways(gateway_id) ON DELETE SET NULL
);


-- Insertion des valeurs dans la table Sensors
-- (Optionnel) Vider avant de ré-insérer
-- DELETE FROM Sensors;

INSERT INTO "Sensors" (
  id_sensor, device_type, commissioning_date, status, building_name, floor, location,
  id_gateway, dev_eui, join_eui, app_key, frequency_plan
) VALUES
('dev_eui_001','device_001','2023-01-01',1,'Batiment A',1,'Bureau 101','gateway-001',
 'A1B2C3D4E5F60701','0102030405060701','00112233445566778899AABBCCDDEEF0','EU_863_870_TTN'),

('dev_eui_002','device_002','2023-02-01',1,'Batiment B',2,'Bureau 202','gateway-002',
 'A1B2C3D4E5F60702','0102030405060702','00112233445566778899AABBCCDDEEF1','EU_863_870_TTN'),

('dev_eui_003','device_003','2023-03-01',0,'Batiment A',3,'Bureau 303','gateway-001',
 'A1B2C3D4E5F60703','0102030405060703','00112233445566778899AABBCCDDEEF2','EU_863_870_TTN'),

('dev_eui_004','device_004','2023-04-01',1,'Batiment C',1,'Bureau 104','gateway-003',
 'A1B2C3D4E5F60704','0102030405060704','00112233445566778899AABBCCDDEEF3','EU_863_870_TTN'),

('dev_eui_005','device_005','2023-05-01',1,'Batiment D',2,'Bureau 205','gateway-004',
 'A1B2C3D4E5F60705','0102030405060705','00112233445566778899AABBCCDDEEF4','US_902_928_FSB_2'),

('dev_eui_006','device_001','2023-06-01',0,'Batiment E',3,'Bureau 306','gateway-005',
 'A1B2C3D4E5F60706','0102030405060706','00112233445566778899AABBCCDDEEF5','AS_920_923'),

('dev_eui_007','device_002','2023-07-01',1,'Batiment A',1,'Bureau 107','gateway-001',
 'A1B2C3D4E5F60707','0102030405060707','00112233445566778899AABBCCDDEEF6','EU_863_870_TTN'),

('dev_eui_008','device_003','2023-08-01',1,'Batiment B',2,'Bureau 208','gateway-002',
 'A1B2C3D4E5F60708','0102030405060708','00112233445566778899AABBCCDDEEF7','EU_863_870_TTN'),

('dev_eui_009','device_004','2023-09-01',0,'Batiment C',3,'Bureau 309','gateway-003',
 'A1B2C3D4E5F60709','0102030405060709','00112233445566778899AABBCCDDEEF8','EU_863_870_TTN'),

('dev_eui_010','device_005','2023-10-01',1,'Batiment D',1,'Bureau 110','gateway-004',
 'A1B2C3D4E5F6070A','010203040506070A','00112233445566778899AABBCCDDEEF9','US_902_928_FSB_2'),

('occup-vs70-03-04','OCCUP','2025-04-01',1,'Batiment Z',3,'Bureau 333',
 'leva-rpi-mantu','24E124773E474166','24E124773E474166','5572404C696E6B4C6F52613230313823','EU_863_870_TTN'),

('pir-light-01-01','PIR_LIGHT','2025-09-09',1,'Châteaudun-Mantu-Building',1,'Entrée principale',
 'rpi-mantu','24E124538D188562','24E124C0002A0001',
 '00112233445566778899AABBCCDDEEF0','EU_863_870_TTN'),

 ('count-03-01','COUNT','2025-09-09',1,'Châteaudun-Mantu-Building',1,'Entrée principale',
  'leva-rpi-mantu','24E124716F198877','24E124C0002A0001',
  '00112233445566778899AABBCCDDEEF0','EU_863_870_TTN'),

 ('co2-03-03','CO2','2025-09-09',1,'Châteaudun-Mantu-Building',1,'Entrée principale',
  'leva-rpi-mantu','A81758FFFE0D5B43','24E124C0002A0001',
  '00112233445566778899AABBCCDDEEF0','EU_863_870_TTN'),

('desk-01-01','DESK','2025-09-09',1,'Châteaudun-Mantu-Building',1,'Bureau 101',
 'rpi-mantu','A81758FFFE0BBB07','0000000000000000',
 '00112233445566778899AABBCCDDEEF0','EU_863_870_TTN');

-- Création de la table Data_emsdesk
CREATE TABLE IF NOT EXISTS "Data_emsdesk" (
    id_sensor VARCHAR(50),
    timestamp DATE,
    humidity INTEGER,
    occupancy INTEGER,
    temperature REAL,
    PRIMARY KEY (id_sensor, timestamp),
    FOREIGN KEY (id_sensor) REFERENCES Sensors(id_sensor) ON DELETE CASCADE
);

-- Insertion des valeurs dans la table Data_emsdesk
INSERT INTO Data_emsdesk (id_sensor, timestamp, humidity, occupancy, temperature) VALUES
('dev_eui_001', '2023-01-01', 45, 1, 22.5),
('dev_eui_002', '2023-02-01', 50, 0, 21.0),
('dev_eui_003', '2023-03-01', 60, 1, 23.0),
('dev_eui_004', '2023-04-01', 55, 1, 24.0),
('dev_eui_005', '2023-05-01', 52, 0, 20.5),
('dev_eui_006', '2023-06-01', 48, 1, 22.0),
('dev_eui_007', '2023-07-01', 49, 1, 21.8),
('dev_eui_008', '2023-08-01', 51, 0, 23.3),
('dev_eui_009', '2023-09-01', 57, 1, 22.2),
('dev_eui_010', '2023-10-01', 55, 0, 20.0);

-- Création de la table Data_pirlight
CREATE TABLE IF NOT EXISTS "Data_pirlight" (
    id_sensor VARCHAR(50),
    timestamp DATE,
    light_statut INTEGER,
    pir_statut INTEGER,
    PRIMARY KEY (id_sensor, timestamp),
    FOREIGN KEY (id_sensor) REFERENCES Sensors(id_sensor) ON DELETE CASCADE
);

-- Insertion des valeurs dans la table Data_pirlight
INSERT INTO "Data_pirlight" (id_sensor, timestamp, light_statut, pir_statut) VALUES
('dev_eui_001', '2023-01-01', 1, 1),
('dev_eui_002', '2023-02-01', 0, 0),
('dev_eui_003', '2023-03-01', 1, 1),
('dev_eui_004', '2023-04-01', 1, 0),
('dev_eui_005', '2023-05-01', 0, 1),
('dev_eui_006', '2023-06-01', 1, 1),
('dev_eui_007', '2023-07-01', 0, 0),
('dev_eui_008', '2023-08-01', 1, 1),
('dev_eui_009', '2023-09-01', 0, 0),
('dev_eui_010', '2023-10-01', 1, 0);

-- Création de la table Signal
CREATE TABLE IF NOT EXISTS "Signal" (
    id_sensor VARCHAR(50),
    timestamp DATE,
    value_battery REAL,
    rssi INTEGER,
    fport INTEGER,
    fcntup INTEGER,
    snr REAL,
    fcntdown INTEGER,
    sf INTEGER,
    frequency_offset REAL,
    PRIMARY KEY (id_sensor, timestamp),
    FOREIGN KEY (id_sensor) REFERENCES Sensors(id_sensor) ON DELETE CASCADE
);

-- Insertion des valeurs dans la table Signal
INSERT INTO "Signal" (id_sensor, timestamp, value_battery, rssi, fport, fcntup, snr, fcntdown, sf, frequency_offset) VALUES
('dev_eui_001', '2023-01-01', 3.7, -90, 1, 10, 12.5, 5, 7, 0.5),
('dev_eui_002', '2023-02-01', 3.8, -85, 1, 11, 13.0, 4, 7, 0.6),
('dev_eui_003', '2023-03-01', 3.6, -80, 1, 12, 14.0, 6, 7, 0.4),
('dev_eui_004', '2023-04-01', 3.5, -95, 1, 13, 12.2, 7, 7, 0.3),
('dev_eui_005', '2023-05-01', 3.9, -87, 1, 14, 13.5, 5, 7, 0.7),
('dev_eui_006', '2023-06-01', 3.7, -82, 1, 15, 11.8, 8, 7, 0.5),
('dev_eui_007', '2023-07-01', 3.6, -84, 1, 16, 13.2, 9, 7, 0.6),
('dev_eui_008', '2023-08-01', 3.8, -88, 1, 17, 12.0, 10, 7, 0.4),
('dev_eui_009', '2023-09-01', 3.5, -86, 1, 18, 14.5, 11, 7, 0.5),
('dev_eui_010', '2023-10-01', 3.7, -83, 1, 19, 11.0, 12, 7, 0.6);

-- Création de la table Users
CREATE TABLE IF NOT EXISTS "Users" (
    username VARCHAR(50) PRIMARY KEY NOT NULL,
    firstname VARCHAR(50) NOT NULL,
    lastname VARCHAR(50) NOT NULL,
    password VARCHAR(50) NOT NULL,
    role VARCHAR(20) NOT NULL,
    email VARCHAR(100) NOT NULL,
    icon VARCHAR(100) DEFAULT 'default-avatar.png'
);

-- Insertion des valeurs dans la table Users
INSERT INTO "Users" (username, firstname, lastname, password, role, email, icon) VALUES
('user1', 'John', 'Doe', '$2a$10$WcXpO7sR8lJAjp2Nti6jR.Q52y3rNN2UKDTquMAhZWaH1.1qNhmfG', 'ADMIN', 'john.doe@example.com', 'default-avatar.png'),
('user2', 'Jane', 'Smith', '$2a$10$WcXpO7sR8lJAjp2Nti6jR.Q52y3rNN2UKDTquMAhZWaH1.1qNhmfG', 'USER', 'jane.smith@example.com', 'default-avatar.png'),
('user3', 'Alice', 'Johnson', '$2a$10$WcXpO7sR8lJAjp2Nti6jR.Q52y3rNN2UKDTquMAhZWaH1.1qNhmfG', 'SUPERUSER', 'alice.johnson@example.com', 'default-avatar.png'),
('user4', 'Bob', 'Brown', '$2a$10$WcXpO7sR8lJAjp2Nti6jR.Q52y3rNN2UKDTquMAhZWaH1.1qNhmfG', 'USER', 'bob.brown@example.com', 'default-avatar.png'),
('user5', 'Charlie', 'Davis', '$2a$10$WcXpO7sR8lJAjp2Nti6jR.Q52y3rNN2UKDTquMAhZWaH1.1qNhmfG', 'ADMIN', 'charlie.davis@example.com', 'default-avatar.png'),
('user6', 'David', 'Wilson', '$2a$10$WcXpO7sR8lJAjp2Nti6jR.Q52y3rNN2UKDTquMAhZWaH1.1qNhmfG', 'USER', 'david.wilson@example.com', 'default-avatar.png'),
('user7', 'Eva', 'Martinez', '$2a$10$WcXpO7sR8lJAjp2Nti6jR.Q52y3rNN2UKDTquMAhZWaH1.1qNhmfG', 'SUPERUSER', 'eva.martinez@example.com', 'default-avatar.png'),
('user8', 'Frank', 'Taylor', '$2a$10$WcXpO7sR8lJAjp2Nti6jR.Q52y3rNN2UKDTquMAhZWaH1.1qNhmfG', 'USER', 'frank.taylor@example.com', 'default-avatar.png'),
('user9', 'Grace', 'Anderson', '$2a$10$WcXpO7sR8lJAjp2Nti6jR.Q52y3rNN2UKDTquMAhZWaH1.1qNhmfG', 'SUPERUSER', 'grace.anderson@example.com', 'default-avatar.png'),
('user10', 'Hannah', 'Thomas', '$2a$10$WcXpO7sR8lJAjp2Nti6jR.Q52y3rNN2UKDTquMAhZWaH1.1qNhmfG', 'ADMIN', 'hannah.thomas@example.com', 'default-avatar.png');
