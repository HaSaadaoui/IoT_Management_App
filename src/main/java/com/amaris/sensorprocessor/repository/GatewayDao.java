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
     * Recherche une gateway par l'id de son Building.
     *
     * @param buildingId ID du building de la gateway à rechercher
     * @return Optional contenant la gateway si trouvée, sinon Optional.empty()
     */
    public List<Gateway> findGatewaysByBuildingId(Integer buildingId) {
        List<Gateway> gateways = jdbcTemplate.query(
                "SELECT * FROM gateways WHERE building_id = ?",
                new BeanPropertyRowMapper<>(Gateway.class),
                buildingId);
        return gateways;
    }

    /**
     * Supprime une gateway en base selon son ID.
     *
     * @param gatewayId ID de la gateway à supprimer
     * @return nombre de lignes supprimées (0 si aucune)
     */
    public int deleteGatewayById(String gatewayId) {
        return jdbcTemplate.update(
                "DELETE FROM gateways WHERE gateway_id = ?",
                gatewayId);
    }

    public void insertGatewayInDatabase(Gateway gateway) {
        jdbcTemplate.update(
                "INSERT INTO gateways (" +
                        "gateway_id, gateway_eui, ip_address, frequency_plan, created_at, " +
                        "building_id, floor_number, location_id, " +
                        "antenna_latitude, antenna_longitude, antenna_altitude, " +
                        "protocol_id) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                gateway.getGatewayId(), gateway.getGatewayEui(), gateway.getIpAddress(),
                gateway.getFrequencyPlan(), gateway.getCreatedAt(),
                gateway.getBuildingId(),
                gateway.getFloorNumber(), gateway.getLocationId(),
                gateway.getAntennaLatitude(), gateway.getAntennaLongitude(), gateway.getAntennaAltitude(),
                gateway.getProtocolId()
        );
    }

    public List<Gateway> findByLocationId(Integer locationId) {
        return jdbcTemplate.query(
                "SELECT * FROM gateways WHERE location_id = ?",
                new BeanPropertyRowMapper<>(Gateway.class),
                locationId);
    }

    public List<Gateway> findByProtocolId(Integer protocolId) {
        return jdbcTemplate.query(
                "SELECT * FROM gateways WHERE protocol_id = ?",
                new BeanPropertyRowMapper<>(Gateway.class),
                protocolId);
    }

    public int updateGatewayInDatabase(Gateway gateway) {
        return jdbcTemplate.update(
                "UPDATE gateways SET " +
                        "ip_address = ?, frequency_plan = ?, building_id = ?, floor_number = ?, " +
                        "location_id = ?, " +
                        "antenna_latitude = ?, antenna_longitude = ?, " +
                        "antenna_altitude = ?, protocol_id = ? " +
                        "WHERE gateway_id = ?",
                gateway.getIpAddress(), gateway.getFrequencyPlan(),
                gateway.getBuildingId(), gateway.getFloorNumber(),
                gateway.getLocationId(),
                gateway.getAntennaLatitude(), gateway.getAntennaLongitude(), gateway.getAntennaAltitude(),
                gateway.getProtocolId(),
                gateway.getGatewayId()
        );
    }

}
