-- MySQL dump 10.13  Distrib 8.0.19, for Win64 (x86_64)
--
-- Host: localhost    Database: smart_buildings
-- ------------------------------------------------------
-- Server version	9.4.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `Data_emsdesk`
--

DROP TABLE IF EXISTS `Data_emsdesk`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Data_emsdesk` (
  `id_sensor` varchar(50) NOT NULL,
  `timestamp` date NOT NULL,
  `humidity` int DEFAULT NULL,
  `occupancy` int DEFAULT NULL,
  `temperature` double DEFAULT NULL,
  PRIMARY KEY (`id_sensor`,`timestamp`),
  CONSTRAINT `Data_emsdesk_ibfk_1` FOREIGN KEY (`id_sensor`) REFERENCES `Sensors` (`id_sensor`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Data_emsdesk`
--

LOCK TABLES `Data_emsdesk` WRITE;
/*!40000 ALTER TABLE `Data_emsdesk` DISABLE KEYS */;
INSERT INTO `Data_emsdesk` VALUES ('dev_eui_001','2023-01-01',45,1,22.5),('dev_eui_002','2023-02-01',50,0,21),('dev_eui_003','2023-03-01',60,1,23),('dev_eui_004','2023-04-01',55,1,24),('dev_eui_005','2023-05-01',52,0,20.5),('dev_eui_006','2023-06-01',48,1,22),('dev_eui_007','2023-07-01',49,1,21.8),('dev_eui_008','2023-08-01',51,0,23.3),('dev_eui_009','2023-09-01',57,1,22.2),('dev_eui_010','2023-10-01',55,0,20);
/*!40000 ALTER TABLE `Data_emsdesk` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Data_pirlight`
--

DROP TABLE IF EXISTS `Data_pirlight`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Data_pirlight` (
  `id_sensor` varchar(50) NOT NULL,
  `timestamp` date NOT NULL,
  `light_statut` int DEFAULT NULL,
  `pir_statut` int DEFAULT NULL,
  PRIMARY KEY (`id_sensor`,`timestamp`),
  CONSTRAINT `Data_pirlight_ibfk_1` FOREIGN KEY (`id_sensor`) REFERENCES `Sensors` (`id_sensor`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Data_pirlight`
--

LOCK TABLES `Data_pirlight` WRITE;
/*!40000 ALTER TABLE `Data_pirlight` DISABLE KEYS */;
INSERT INTO `Data_pirlight` VALUES ('dev_eui_001','2023-01-01',1,1),('dev_eui_002','2023-02-01',0,0),('dev_eui_003','2023-03-01',1,1),('dev_eui_004','2023-04-01',1,0),('dev_eui_005','2023-05-01',0,1),('dev_eui_006','2023-06-01',1,1),('dev_eui_007','2023-07-01',0,0),('dev_eui_008','2023-08-01',1,1),('dev_eui_009','2023-09-01',0,0),('dev_eui_010','2023-10-01',1,0);
/*!40000 ALTER TABLE `Data_pirlight` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Gateways`
--

DROP TABLE IF EXISTS `Gateways`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Gateways` (
  `gateway_id` varchar(50) NOT NULL,
  `gateway_eui` varchar(50) NOT NULL,
  `ip_address` varchar(50) NOT NULL,
  `frequency_plan` varchar(50) NOT NULL,
  `created_at` datetime NOT NULL,
  `building_name` varchar(50) NOT NULL,
  `floor_number` int NOT NULL,
  `location_description` varchar(50) DEFAULT NULL,
  `antenna_latitude` float DEFAULT NULL,
  `antenna_longitude` float DEFAULT NULL,
  `antenna_altitude` float DEFAULT NULL,
  PRIMARY KEY (`gateway_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Gateways`
--

LOCK TABLES `Gateways` WRITE;
/*!40000 ALTER TABLE `Gateways` DISABLE KEYS */;
INSERT INTO `Gateways` VALUES ('gateway-001','4446C001F55527AB','192.168.1.10','EU_863_870_TTN','2023-01-01 00:00:00','Batiment A',1,'Open space A',NULL,NULL,NULL),('gateway-002','4254C001F75641AA','192.168.1.11','EU_863_870_TTN','2023-02-01 00:00:00','Batiment B',2,'Bureau 202',NULL,NULL,NULL),('gateway-003','0016C333F98761BA','192.168.1.12','EU_863_870_TTN','2023-03-01 00:00:00','Batiment A',3,'Open space F',NULL,NULL,NULL),('gateway-004','3316C001F99927AB','192.168.1.13','US_902_928_FSB_2','2023-04-01 00:00:00','Batiment C',1,'Bureau 104',NULL,NULL,NULL),('gateway-005','4416C005F16747DB','192.168.1.14','AS_920_923','2023-05-01 00:00:00','Batiment D',2,'Bureau 205',NULL,NULL,NULL),('gateway-006','0016C661F10333BA','192.168.1.15','US_902_928_FSB_2','2023-06-01 00:00:00','Batiment A',1,'Open space K',NULL,NULL,NULL),('gateway-007','2216C441F16727CB','192.168.1.16','AU_915_928_FSB_2','2023-07-01 00:00:00','Batiment B',2,'Bureau 206',NULL,NULL,NULL),('gateway-008','0016C441F10534BA','192.168.1.17','AU_915_928_FSB_2','2023-08-01 00:00:00','Batiment A',3,'Bureau 306',NULL,NULL,NULL),('gateway-009','0321C001F44427AA','192.168.1.18','CN_470_510_FSB_11','2023-09-01 00:00:00','Batiment C',1,'Open space T',NULL,NULL,NULL),('gateway-010','0016C021F10543AB','192.168.1.19','EU_863_870_TTN','2023-10-01 00:00:00','Batiment A',2,'Open space U',NULL,NULL,NULL),('leva-rpi-mantu','0016C001F10527BB','10.243.128.3','EU_863_870_TTN','2025-04-14 00:00:00','Levallois',3,'Bureau 333',0,0,0),('lil-rpi-mantu','1122334455667789','10.243.127.5','EU_863_870_TTN','2025-09-02 00:00:00','Lille',4,'Open space U',0,0,0),('rpi-mantu','0016C001F1054209','10.243.129.10','EU_863_870_TTN','2024-07-25 00:00:00','Châteaudun',3,'Bureau 333',0,0,0);
/*!40000 ALTER TABLE `Gateways` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Sensors`
--

DROP TABLE IF EXISTS `Sensors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Sensors` (
  `id_sensor` varchar(50) NOT NULL,
  `device_type` varchar(50) NOT NULL,
  `commissioning_date` date NOT NULL,
  `status` tinyint(1) NOT NULL,
  `building_name` varchar(100) NOT NULL,
  `floor` int NOT NULL,
  `location` varchar(50) DEFAULT NULL,
  `id_gateway` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id_sensor`),
  KEY `id_gateway` (`id_gateway`),
  CONSTRAINT `Sensors_ibfk_1` FOREIGN KEY (`id_gateway`) REFERENCES `Gateways` (`gateway_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Sensors`
--

LOCK TABLES `Sensors` WRITE;
/*!40000 ALTER TABLE `Sensors` DISABLE KEYS */;
INSERT INTO `Sensors` VALUES ('dev_eui_001','device_001','2023-01-01',1,'Batiment A',1,'Bureau 101','gateway-001'),('dev_eui_002','device_002','2023-02-01',1,'Batiment B',2,'Bureau 202','gateway-002'),('dev_eui_003','device_003','2023-03-01',0,'Batiment A',3,'Bureau 303','gateway-001'),('dev_eui_004','device_004','2023-04-01',1,'Batiment C',1,'Bureau 104','gateway-003'),('dev_eui_005','device_005','2023-05-01',1,'Batiment D',2,'Bureau 205','gateway-004'),('dev_eui_006','device_001','2023-06-01',0,'Batiment E',3,'Bureau 306','gateway-005'),('dev_eui_007','device_002','2023-07-01',1,'Batiment A',1,'Bureau 107','gateway-001'),('dev_eui_008','device_003','2023-08-01',1,'Batiment B',2,'Bureau 208','gateway-002'),('dev_eui_009','device_004','2023-09-01',0,'Batiment C',3,'Bureau 309','gateway-003'),('dev_eui_010','device_005','2023-10-01',1,'Batiment D',1,'Bureau 110','gateway-004');
/*!40000 ALTER TABLE `Sensors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Signal`
--

DROP TABLE IF EXISTS `Signal`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Signal` (
  `id_sensor` varchar(50) NOT NULL,
  `timestamp` date NOT NULL,
  `value_battery` float DEFAULT NULL,
  `rssi` int DEFAULT NULL,
  `fport` int DEFAULT NULL,
  `fcntup` int DEFAULT NULL,
  `snr` float DEFAULT NULL,
  `fcntdown` int DEFAULT NULL,
  `sf` int DEFAULT NULL,
  `frequency_offset` float DEFAULT NULL,
  PRIMARY KEY (`id_sensor`,`timestamp`),
  CONSTRAINT `Signal_ibfk_1` FOREIGN KEY (`id_sensor`) REFERENCES `Sensors` (`id_sensor`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Signal`
--

LOCK TABLES `Signal` WRITE;
/*!40000 ALTER TABLE `Signal` DISABLE KEYS */;
INSERT INTO `Signal` VALUES ('dev_eui_001','2023-01-01',3.7,-90,1,10,12.5,5,7,0.5),('dev_eui_002','2023-02-01',3.8,-85,1,11,13,4,7,0.6),('dev_eui_003','2023-03-01',3.6,-80,1,12,14,6,7,0.4),('dev_eui_004','2023-04-01',3.5,-95,1,13,12.2,7,7,0.3),('dev_eui_005','2023-05-01',3.9,-87,1,14,13.5,5,7,0.7),('dev_eui_006','2023-06-01',3.7,-82,1,15,11.8,8,7,0.5),('dev_eui_007','2023-07-01',3.6,-84,1,16,13.2,9,7,0.6),('dev_eui_008','2023-08-01',3.8,-88,1,17,12,10,7,0.4),('dev_eui_009','2023-09-01',3.5,-86,1,18,14.5,11,7,0.5),('dev_eui_010','2023-10-01',3.7,-83,1,19,11,12,7,0.6);
/*!40000 ALTER TABLE `Signal` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Users`
--

DROP TABLE IF EXISTS `Users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Users` (
  `username` varchar(50) NOT NULL,
  `firstname` varchar(50) NOT NULL,
  `lastname` varchar(50) NOT NULL,
  `password` varchar(100) NOT NULL,
  `role` varchar(20) NOT NULL,
  `email` varchar(100) NOT NULL,
  `icon` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Users`
--

LOCK TABLES `Users` WRITE;
/*!40000 ALTER TABLE `Users` DISABLE KEYS */;
INSERT INTO `Users` VALUES ('sayf','msr','ss','password123','USER','msr@mantu.com','default-avatar.png'),('user1','John','Doe','$2a$10$WcXpO7sR8lJAjp2Nti6jR.Q52y3rNN2UKDTquMAhZWaH1.1qNhmfG','ADMIN','john.doe@example.com','default-avatar.png'),('user10','Hannah','Thomas','$2a$10$WcXpO7sR8lJAjp2Nti6jR.Q52y3rNN2UKDTquMAhZWaH1.1qNhmfG','ADMIN','hannah.thomas@example.com',NULL),('user2','Jane','Smith','$2a$10$WcXpO7sR8lJAjp2Nti6jR.Q52y3rNN2UKDTquMAhZWaH1.1qNhmfG','USER','jane.smith@example.com','default-avatar.png'),('user3','Alice','Johnson','$2a$10$WcXpO7sR8lJAjp2Nti6jR.Q52y3rNN2UKDTquMAhZWaH1.1qNhmfG','SUPERUSER','alice.johnson@example.com','default-avatar.png'),('user4','Bob','Brown','$2a$10$WcXpO7sR8lJAjp2Nti6jR.Q52y3rNN2UKDTquMAhZWaH1.1qNhmfG','USER','bob.brown@example.com','default-avatar.png'),('user5','Charlie','Davis','$2a$10$WcXpO7sR8lJAjp2Nti6jR.Q52y3rNN2UKDTquMAhZWaH1.1qNhmfG','ADMIN','charlie.davis@example.com','default-avatar.png'),('user6','David','Wilson','$2a$10$WcXpO7sR8lJAjp2Nti6jR.Q52y3rNN2UKDTquMAhZWaH1.1qNhmfG','USER','david.wilson@example.com','default-avatar.png'),('user7','Eva','Martinez','$2a$10$WcXpO7sR8lJAjp2Nti6jR.Q52y3rNN2UKDTquMAhZWaH1.1qNhmfG','SUPERUSER','eva.martinez@example.com','default-avatar.png'),('user8','Frank','Taylor','$2a$10$WcXpO7sR8lJAjp2Nti6jR.Q52y3rNN2UKDTquMAhZWaH1.1qNhmfG','USER','frank.taylor@example.com','default-avatar.png'),('user9','Grace','Anderson','$2a$10$WcXpO7sR8lJAjp2Nti6jR.Q52y3rNN2UKDTquMAhZWaH1.1qNhmfG','SUPERUSER','grace.anderson@example.com','default-avatar.png');
/*!40000 ALTER TABLE `Users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pending_users`
--

DROP TABLE IF EXISTS `pending_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pending_users` (
  `email` varchar(100) NOT NULL,
  `username` text NOT NULL,
  `firstname` text,
  `lastname` text,
  `password` text NOT NULL,
  `role` text,
  `icon` text,
  `token_hash` text NOT NULL,
  `expires_at` text NOT NULL,
  `resend_count` int DEFAULT '0',
  `last_resend_at` text,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pending_users`
--

LOCK TABLES `pending_users` WRITE;
/*!40000 ALTER TABLE `pending_users` DISABLE KEYS */;
/*!40000 ALTER TABLE `pending_users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'smart_buildings'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-16 16:27:44
