package com.amaris.sensorprocessor.repository;

import com.amaris.sensorprocessor.entity.Gateway;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class GatewayDao {

    private final JdbcTemplate jdbcTemplate;

    @Autowired
    public GatewayDao(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Récupère toutes les gateways triées par ID (insensible à la casse).
     *
     * @return Liste de toutes les gateways, vide si aucune trouvée
     */
    public List<Gateway> findAllGateways() {
        return jdbcTemplate.query(
            "SELECT * FROM gateways ORDER BY LOWER(GATEWAY_ID) ASC;",
            new BeanPropertyRowMapper<Gateway>(Gateway.class));
    }

    /**
     * Recherche une gateway par son identifiant.
     *
     * @param gatewayId ID de la gateway à rechercher
     * @return Optional contenant la gateway si trouvée, sinon Optional.empty()
     */
    public Optional<Gateway> findGatewayById(String gatewayId) {
        List<Gateway> gateways = jdbcTemplate.query(
            "SELECT * FROM gateways WHERE GATEWAY_ID=?",
            new BeanPropertyRowMapper<>(Gateway.class),
            gatewayId);

        return gateways.isEmpty() ? Optional.empty() : Optional.of(gateways.get(0));
    }

    /**
     * Supprime une gateway en base selon son ID.
     *
     * @param gatewayId ID de la gateway à supprimer
     * @return nombre de lignes supprimées (0 si aucune)
     */
    public int deleteGatewayById(String gatewayId) {
        return jdbcTemplate.update(
            "DELETE FROM gateways WHERE GATEWAY_ID=?",
            gatewayId);
    }

    /**
     * Insère une nouvelle gateway en base.
     *
     * @param gateway objet Gateway à insérer
     */
    public void insertGatewayInDatabase(Gateway gateway) {
        jdbcTemplate.update(
            "INSERT INTO gateways (" +
                    "GATEWAY_ID, GATEWAY_EUI, IP_ADDRESS, FREQUENCY_PLAN, CREATED_AT, " +
                    "BUILDING_NAME, FLOOR_NUMBER, LOCATION_DESCRIPTION, " +
                    "ANTENNA_LATITUDE, ANTENNA_LONGITUDE, ANTENNA_ALTITUDE) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            gateway.getGatewayId(), gateway.getGatewayEui(), gateway.getIpAddress(), gateway.getFrequencyPlan(),
            gateway.getCreatedAt(), gateway.getBuildingName(), gateway.getFloorNumber(), gateway.getLocationDescription(),
            gateway.getAntennaLatitude(), gateway.getAntennaLongitude(), gateway.getAntennaAltitude()
        );
    }

    /**
     * Met à jour une gateway existante avec toutes ses données selon son ID.
     *
     * @param gateway Objet Gateway contenant les nouvelles valeurs.
     * @return Nombre de lignes modifiées (0 si aucune correspondance).
     */
    public int updateGatewayInDatabase(Gateway gateway) {
        return jdbcTemplate.update(
            "UPDATE gateways SET " +
                    "IP_ADDRESS = ?, FREQUENCY_PLAN = ?, BUILDING_NAME = ?, FLOOR_NUMBER = ?, " +
                    "LOCATION_DESCRIPTION = ?, ANTENNA_LATITUDE = ?, ANTENNA_LONGITUDE = ?, " +
                    "ANTENNA_ALTITUDE = ? " +
                    "WHERE GATEWAY_ID = ?",
            gateway.getIpAddress(), gateway.getFrequencyPlan(), gateway.getBuildingName(),
                gateway.getFloorNumber(), gateway.getLocationDescription(), gateway.getAntennaLatitude(),
                gateway.getAntennaLongitude(), gateway.getAntennaAltitude(), gateway.getGatewayId()
        );
    }

}
