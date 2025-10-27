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
INSERT INTO `Gateways` VALUES ('leva-rpi-mantu','0016C001F10527BB','10.243.128.3','EU_863_870_TTN','2025-04-14 00:00:00','Levallois',3,'Bureau 333',0,0,0),('lil-rpi-mantu','1122334455667789','10.243.127.5','EU_863_870_TTN','2025-09-02 00:00:00','Lille',4,'Open space U',0,0,0),('rpi-mantu','0016C001F1054209','10.243.129.10','EU_863_870_TTN','2024-07-25 00:00:00','Châteaudun',3,'Bureau 333',0,0,0);
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
  `commissioning_date` timestamp(6) NOT NULL,
  `status` tinyint(1) NOT NULL,
  `building_name` varchar(100) NOT NULL,
  `floor` int NOT NULL,
  `location` varchar(50) DEFAULT NULL,
  `id_gateway` varchar(50) DEFAULT NULL,
  `dev_eui` text,
  `join_eui` text,
  `app_key` text,
  `frequency_plan` varchar(50) DEFAULT NULL,
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
INSERT INTO `Sensors` VALUES ('co2-03-01','CO2','2025-09-09 09:40:45.146468',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D615D','','','EU_863_870_TTN'),('co2-03-02','CO2','2025-09-09 09:40:46.252311',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE08E12F','','','EU_863_870_TTN'),('co2-03-03','CO2','2025-09-09 09:40:47.293656',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D5B43','','','EU_863_870_TTN'),('conso-squid-03-01','CONSO','2025-09-09 09:40:48.354486',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','70B3D54750121261','','','EU_863_870_TTN'),('count-03-01','COUNT','2025-09-09 09:40:49.348063',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','24E124716F198877','','','EU_863_870_TTN'),('desk-01-01','DESK','2025-09-09 09:57:37.757810',1,'Châteaudun-Building',2,'Floor 2','rpi-mantu','A81758FFFE0BBB07','','','EU_863_870_TTN'),('desk-01-02','DESK','2025-09-09 10:08:22.835483',1,'Châteaudun-Building',2,'Floor 2','rpi-mantu','A81758FFFE0BBB0C','','','EU_863_870_TTN'),('desk-03-01','DESK','2025-06-23 09:55:17.508666',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7BAD','','','EU_863_870_TTN'),('desk-03-02','DESK','2025-06-23 10:08:46.972727',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7BA4','','','EU_863_870_TTN'),('desk-03-03','DESK','2025-06-23 10:10:33.427591',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7BA5','','','EU_863_870_TTN'),('desk-03-04','DESK','2025-06-23 10:12:11.858339',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7BA6','','','EU_863_870_TTN'),('desk-03-05','DESK','2025-06-23 10:15:01.249712',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7BA7','','','EU_863_870_TTN'),('desk-03-06','DESK','2025-06-23 10:17:37.243739',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7BA8','','','EU_863_870_TTN'),('desk-03-07','DESK','2025-06-23 10:19:26.281951',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7BA9','','','EU_863_870_TTN'),('desk-03-08','DESK','2025-06-23 10:21:31.280676',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7BAA','','','EU_863_870_TTN'),('desk-03-09','DESK','2025-06-23 10:23:30.562965',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7BAC','','','EU_863_870_TTN'),('desk-03-10','DESK','2025-06-23 10:26:50.188186',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7BAB','','','EU_863_870_TTN'),('desk-03-11','DESK','2025-06-23 14:10:58.838524',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7A95','','','EU_863_870_TTN'),('desk-03-12','DESK','2025-06-23 14:12:39.032595',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7A94','','','EU_863_870_TTN'),('desk-03-13','DESK','2025-06-23 14:14:32.077007',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7A93','','','EU_863_870_TTN'),('desk-03-14','DESK','2025-06-23 14:16:07.695892',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7A92','','','EU_863_870_TTN'),('desk-03-15','DESK','2025-06-23 14:17:29.384109',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7A91','','','EU_863_870_TTN'),('desk-03-16','DESK','2025-06-23 14:19:02.363346',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7A90','','','EU_863_870_TTN'),('desk-03-17','DESK','2025-06-23 14:21:16.332967',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7A8F','','','EU_863_870_TTN'),('desk-03-18','DESK','2025-06-23 14:22:59.702559',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7A8E','','','EU_863_870_TTN'),('desk-03-19','DESK','2025-06-23 14:24:19.781265',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7A8D','','','EU_863_870_TTN'),('desk-03-20','DESK','2025-06-23 14:28:17.355710',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7A8C','','','EU_863_870_TTN'),('desk-03-21','DESK','2025-06-23 14:32:34.006804',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7AC7','','','EU_863_870_TTN'),('desk-03-22','DESK','2025-06-23 14:34:07.931166',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7AC6','','','EU_863_870_TTN'),('desk-03-23','DESK','2025-06-23 14:35:29.027844',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7AC5','','','EU_863_870_TTN'),('desk-03-24','DESK','2025-06-23 14:36:54.922408',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7AC4','','','EU_863_870_TTN'),('desk-03-25','DESK','2025-06-23 14:38:13.423465',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7AC3','','','EU_863_870_TTN'),('desk-03-26','DESK','2025-06-23 14:39:37.857677',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7AC2','','','EU_863_870_TTN'),('desk-03-27','DESK','2025-06-23 14:41:23.339030',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7AC1','','','EU_863_870_TTN'),('desk-03-28','DESK','2025-06-23 14:42:56.623854',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7AC0','','','EU_863_870_TTN'),('desk-03-29','DESK','2025-06-23 14:44:16.362039',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7ABF','','','EU_863_870_TTN'),('desk-03-30','DESK','2025-06-23 14:45:42.890548',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7ABE','','','EU_863_870_TTN'),('desk-03-31','DESK','2025-07-01 15:57:06.424549',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7C2E','','','EU_863_870_TTN'),('desk-03-32','DESK','2025-07-01 15:58:52.599296',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7C26','','','EU_863_870_TTN'),('desk-03-33','DESK','2025-07-01 16:00:07.736824',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7C2A','','','EU_863_870_TTN'),('desk-03-34','DESK','2025-07-01 16:01:24.123428',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7C2F','','','EU_863_870_TTN'),('desk-03-35','DESK','2025-07-01 16:02:36.535131',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7C2D','','','EU_863_870_TTN'),('desk-03-36','DESK','2025-07-01 16:03:45.696263',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7C2C','','','EU_863_870_TTN'),('desk-03-37','DESK','2025-07-01 16:04:59.514424',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7C2B','','','EU_863_870_TTN'),('desk-03-38','DESK','2025-07-01 16:06:10.369642',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7C29','','','EU_863_870_TTN'),('desk-03-39','DESK','2025-07-01 16:07:21.383376',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7C28','','','EU_863_870_TTN'),('desk-03-40','DESK','2025-07-01 16:08:35.306683',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7C27','','','EU_863_870_TTN'),('desk-03-41','DESK','2025-07-02 10:11:37.732879',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D792D','','','EU_863_870_TTN'),('desk-03-42','DESK','2025-07-02 10:42:14.011604',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D792C','','','EU_863_870_TTN'),('desk-03-43','DESK','2025-07-02 10:46:19.380081',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D792B','','','EU_863_870_TTN'),('desk-03-44','DESK','2025-07-02 10:50:34.018057',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D792A','','','EU_863_870_TTN'),('desk-03-45','DESK','2025-07-02 11:09:25.401039',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7AD1','','','EU_863_870_TTN'),('desk-03-46','DESK','2025-07-02 11:50:09.561815',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7928','','','EU_863_870_TTN'),('desk-03-47','DESK','2025-07-02 11:55:56.303329',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7927','','','EU_863_870_TTN'),('desk-03-48','DESK','2025-07-02 12:01:38.026262',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7926','','','EU_863_870_TTN'),('desk-03-49','DESK','2025-07-02 12:12:06.722091',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7925','','','EU_863_870_TTN'),('desk-03-50','DESK','2025-07-02 12:13:31.605624',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7924','','','EU_863_870_TTN'),('desk-03-51','DESK','2025-07-02 13:08:29.693297',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7AC8','','','EU_863_870_TTN'),('desk-03-52','DESK','2025-07-02 13:09:39.968755',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7AC9','','','EU_863_870_TTN'),('desk-03-53','DESK','2025-07-02 13:11:44.671698',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7ACA','','','EU_863_870_TTN'),('desk-03-54','DESK','2025-07-02 13:13:22.974491',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7ACB','','','EU_863_870_TTN'),('desk-03-55','DESK','2025-07-02 13:15:00.020836',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7ACC','','','EU_863_870_TTN'),('desk-03-56','DESK','2025-07-02 13:16:28.565291',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7ACD','','','EU_863_870_TTN'),('desk-03-57','DESK','2025-07-02 13:17:51.540361',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7ACE','','','EU_863_870_TTN'),('desk-03-58','DESK','2025-07-02 13:19:05.958879',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7ACF','','','EU_863_870_TTN'),('desk-03-59','DESK','2025-07-02 13:20:26.686536',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7AD0','','','EU_863_870_TTN'),('desk-03-60','DESK','2025-07-02 13:21:57.338449',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7929','','','EU_863_870_TTN'),('desk-03-61','DESK','2025-07-03 12:56:18.891317',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D4CF9','','','EU_863_870_TTN'),('desk-03-62','DESK','2025-07-03 12:58:15.567406',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D4CF8','','','EU_863_870_TTN'),('desk-03-63','DESK','2025-07-03 13:00:55.185759',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D4CF7','','','EU_863_870_TTN'),('desk-03-64','DESK','2025-07-03 13:02:20.367990',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D4CF6','','','EU_863_870_TTN'),('desk-03-65','DESK','2025-07-03 13:03:30.309427',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D4CF5','','','EU_863_870_TTN'),('desk-03-66','DESK','2025-07-03 13:04:41.492789',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D4CF4','','','EU_863_870_TTN'),('desk-03-67','DESK','2025-07-03 13:05:56.837374',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D4CFC','','','EU_863_870_TTN'),('desk-03-68','DESK','2025-07-03 13:07:20.500272',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D4CF3','','','EU_863_870_TTN'),('desk-03-69','DESK','2025-07-03 13:08:44.435245',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D4CFA','','','EU_863_870_TTN'),('desk-03-70','DESK','2025-07-03 13:09:56.167273',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D4CFB','','','EU_863_870_TTN'),('desk-03-71','DESK','2025-07-03 13:24:38.258071',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D79C2','','','EU_863_870_TTN'),('desk-03-72','DESK','2025-07-03 13:26:39.503152',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D79C0','','','EU_863_870_TTN'),('desk-03-73','DESK','2025-07-03 13:52:55.546020',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D79C3','','','EU_863_870_TTN'),('desk-03-74','DESK','2025-07-03 13:54:51.909267',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D79BA','','','EU_863_870_TTN'),('desk-03-75','DESK','2025-07-03 13:55:40.320108',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D79C1','','','EU_863_870_TTN'),('desk-03-76','DESK','2025-07-03 13:57:10.572238',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D79BF','','','EU_863_870_TTN'),('desk-03-77','DESK','2025-07-03 13:58:56.408460',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D79BE','','','EU_863_870_TTN'),('desk-03-78','DESK','2025-07-03 14:01:10.443738',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D79BD','','','EU_863_870_TTN'),('desk-03-79','DESK','2025-07-03 14:09:20.841836',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D79BC','','','EU_863_870_TTN'),('desk-03-80','DESK','2025-07-03 14:03:39.986053',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D79BB','','','EU_863_870_TTN'),('desk-03-81','DESK','2025-07-03 14:23:52.309878',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7937','','','EU_863_870_TTN'),('desk-03-82','DESK','2025-07-03 14:25:20.628655',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7936','','','EU_863_870_TTN'),('desk-03-83','DESK','2025-07-03 14:26:33.328987',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7935','','','EU_863_870_TTN'),('desk-03-84','DESK','2025-07-03 14:38:43.147429',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7933','','','EU_863_870_TTN'),('desk-03-85','DESK','2025-07-03 14:29:45.653006',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7934','','','EU_863_870_TTN'),('desk-03-86','DESK','2025-07-03 14:53:38.593304',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7932','','','EU_863_870_TTN'),('desk-03-87','DESK','2025-07-03 14:56:03.723005',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7931','','','EU_863_870_TTN'),('desk-03-88','DESK','2025-07-03 14:57:42.204871',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D7930','','','EU_863_870_TTN'),('desk-03-89','DESK','2025-07-03 14:59:45.257489',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D792F','','','EU_863_870_TTN'),('desk-03-90','DESK','2025-07-03 15:01:49.112420',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0D792E','','','EU_863_870_TTN'),('desk-vs40-03-01','DESK','2025-07-08 10:46:30.186392',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','24E124787E305504','','','EU_863_870_TTN'),('desk-vs41-03-01','DESK','2025-07-08 10:13:01.210685',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','24E124787F014055','','','EU_863_870_TTN'),('desk-vs41-03-02','DESK','2025-07-08 10:07:22.744125',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','24E124787F014002','','','EU_863_870_TTN'),('desk-vs41-03-03','DESK','2025-07-08 10:19:19.813028',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','24E124787F012831','','','EU_863_870_TTN'),('desk-vs41-03-04','DESK','2025-07-08 10:16:22.057855',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','24E124787F012334','','','EU_863_870_TTN'),('eye-03-01','EYE','2025-06-17 14:33:20.104957',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0DBAB9','','','EU_863_870_TTN'),('eye-03-02','EYE','2025-06-17 15:11:46.246127',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0DBAB8','','','EU_863_870_TTN'),('eye-03-03','EYE','2025-06-17 15:09:18.348913',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','A81758FFFE0DBAB7','','','EU_863_870_TTN'),('occup-vs30-03-01','OCCUP','2025-07-08 10:56:38.344739',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','24E124617E264188','','','EU_863_870_TTN'),('occup-vs30-03-02','OCCUP','2025-07-08 11:01:39.437371',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','24E124617E265390','','','EU_863_870_TTN'),('occup-vs70-03-01','OCCUP','2025-07-08 12:52:24.517093',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','24E124773E476665','','','EU_863_870_TTN'),('occup-vs70-03-02','OCCUP','2025-07-08 12:57:59.847641',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','24E124773E473996','','','EU_863_870_TTN'),('occup-vs70-03-03','OCCUP','2025-07-08 13:02:16.351163',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','24E124773E474008','','','EU_863_870_TTN'),('occup-vs70-03-04','OCCUP','2025-07-08 13:06:24.459089',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','24E124773E474166','','','EU_863_870_TTN'),('pir-light-01-01','PIR_LIGHT','2025-09-09 10:21:23.605604',1,'Châteaudun-Building',2,'Floor 2','rpi-mantu','24E124538D188562','','','EU_863_870_TTN'),('son-03-01','SON','2025-07-07 13:31:17.160649',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','24E124743F069298','','','EU_863_870_TTN'),('son-03-02','SON','2025-07-07 15:43:01.800187',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','24E124743F069046','','','EU_863_870_TTN'),('son-03-03','SON','2025-07-07 16:09:25.494511',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','24E124743F068742','','','EU_863_870_TTN'),('son-03-04','SON','2025-07-07 16:14:14.829105',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','24E124743F065973','','','EU_863_870_TTN'),('tempex-03-01','TEMPEX','2025-07-07 16:22:28.440155',1,'Levallois-Building',3,'Floor 3','leva-rpi-mantu','24E124136F113128','','','EU_863_870_TTN');
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
INSERT INTO `Users` VALUES ('hugo','hugo','hugo','$2a$10$t.6PxLp5X9B5JO5xw4rJ6eXpqwo1O8bUPPsTLab8ssR2sCDxGKOZW','USER','hugo10@exemple.com','/uploads/20251014_173442_62939_bleach_hollow_ichigo.jpg'),('hugo7','youssef','khnissi','$2a$10$EbEIO1GhsmsxWIi.IGxzGOg7kI2O5K3LrFrYV9n.ImxjhX/MLqHcu','USER','khnissi@futurnet.fr','/image/default-avatar.png'),('huser','h','f','$2a$10$zTfMlO.3dIpudY711pa5z.Ic4uevbh8AHtoOTsDbtm2fAG2IGJuHS','USER','mail@gmail.com','/image/default-avatar.png'),('muser','marwan','m','$2a$10$9YxdjcTIeOrF/qHZZ3cdue9T7/TPUJkTWVXDwA1nSq3FJIEnvlbOe','USER','msr.bran20@gmail.com','/uploads/20251014_160459_batman-pfp-6.webp'),('saif','saif','saif','$2a$10$EibBD6oeV8vFaiuk8gr21ucLCvbpFYnKcZpKDgAhnI8JxLC9/Bqzu','USER','mosratisayf20@gmail.com','/uploads/20251017_120144_Nightwing-Dc-Comics-PFP-20.webp'),('seraph','Séraphin','Verbeke','$2a$10$poFNSBmscjkNb6ZAFJdsUOwqvihupvx1HLIiq/O19NFoep77tBJSe','SUPERUSER','seraf01@live.fr','/uploads/20251010_103958_image.png'),('testuser','Test','User','$2a$10$eYziMMeSRA2A091vuiTOq.s1NJHpwVtcLupeXoJU3E0Y52MzOcy5K','USER','test@example.com','/image/default-avatar.png'),('user1','Johnn','Doess','$2a$10$WcXpO7sR8lJAjp2Nti6jR.Q52y3rNN2UKDTquMAhZWaH1.1qNhmfG','ADMIN','john.doe@example.com','/image/default-avatar.png'),('user3','Alice','Johnson','$2a$10$WcXpO7sR8lJAjp2Nti6jR.Q52y3rNN2UKDTquMAhZWaH1.1qNhmfG','SUPERUSER','alice.johnson@example.com','/image/default-avatar.png'),('user4','Bob','Brown','$2a$10$WcXpO7sR8lJAjp2Nti6jR.Q52y3rNN2UKDTquMAhZWaH1.1qNhmfG','USER','bob.brown@example.com','/image/default-avatar.png'),('user5','Charlie','Davis56','$2a$10$pbiynIjfUXO5vo29yD1TWuG4EUVJ8gM9nb3RXgyxSemib5DScgoPm','ADMIN','charlie.davis@example.com','/uploads/20251013_110308_chevre.png'),('user555','222','222','$2a$10$hKmhyhNGfUPolXod.Yn8beKs8CJ0cTeW9UDJbZIdWV75NK3Z.BSV6','USER','hannah.thomas@example.com','/image/default-avatar.png'),('user65','sss','ssss','$2a$10$ugQL6Dyj6fqWj8OQs5JACuv9ILQJGquhqBMcd3tvmdaPr1V841QAG','USER','seraf01@live.fr','/image/default-avatar.png'),('user9','Grace','Anderson','$2a$10$WcXpO7sR8lJAjp2Nti6jR.Q52y3rNN2UKDTquMAhZWaH1.1qNhmfG','SUPERUSER','grace.anderson@example.com','/image/default-avatar.png'),('veruser','us','er','$2a$10$XVpij7eGfIfkjbbUQ1d8JeMYkOsTAP19FnAKyQ2BNHZMa0fQJHfuu','USER','khnissi@futurnet.frss','/image/default-avatar.png'),('youssef','f','f','$2a$10$e8032i42UPP5ElEJ/dVoheBPiLzfdObgyEr5rAsHMM5I7bCCQ3VRy','USER','mosratisayf20@gmail.com','/uploads/20251016_181426_batman-pfp-6.webp');
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
INSERT INTO `pending_users` VALUES ('sayfmosrati20@gmail.com','hana','hana','hana','$2a$10$2sJkntPv3Av5N3pxPdVC0eDECGAPWJIjnniM/0FCehPTN976FIClq','USER','/image/default-avatar.png','c897fe65836785ec8311491d12851804336c42be1ec18e46bd1e2e58c1035786','2025-10-18T08:12:19.831444100Z',0,''),('test-signup@example.com','tester','Test','User','$2a$10$z35cw4dHczG8cE09TMmHLuwkq.OOmzV0ZUQMlkwzkQ9XKP6UYDCgy','USER','/image/default-avatar.png','734b326de93d6a6f7f8d38e950a27577b0811d50f8c48449d2310225403b14da','2025-10-17T16:00:04.786546800Z',0,'');
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

-- Dump completed on 2025-10-27 12:42:38
