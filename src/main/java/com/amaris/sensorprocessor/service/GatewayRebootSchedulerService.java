package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.Gateway;
import com.amaris.sensorprocessor.entity.GatewayRebootSchedule;
import com.amaris.sensorprocessor.repository.GatewayRebootScheduleDao;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

@Service
public class GatewayRebootSchedulerService {

    private static final int DEFAULT_INTERVAL_MINUTES = 1440;
    private static final int MIN_INTERVAL_MINUTES = 1;

    private final Logger logger = LoggerFactory.getLogger(this.getClass());
    private final GatewayRebootScheduleDao scheduleDao;
    private final GatewayService gatewayService;
    private final ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor();
    private final Map<String, ScheduledFuture<?>> scheduledReboots = new ConcurrentHashMap<>();

    public GatewayRebootSchedulerService(GatewayRebootScheduleDao scheduleDao, GatewayService gatewayService) {
        this.scheduleDao = scheduleDao;
        this.gatewayService = gatewayService;
    }

    @PostConstruct
    public void initialize() {
        scheduleDao.initializeTable();
        scheduleDao.findEnabled().forEach(this::scheduleReboot);
    }

    @PreDestroy
    public void shutdown() {
        scheduledReboots.values().forEach(future -> future.cancel(false));
        executor.shutdownNow();
    }

    public List<Map<String, Object>> findAllGatewaySchedules() {
        Map<String, GatewayRebootSchedule> schedulesByGateway = new LinkedHashMap<>();
        scheduleDao.findAll().forEach(schedule -> schedulesByGateway.put(schedule.getGatewayId(), schedule));

        return gatewayService.getAllGateways().stream()
                .map(gateway -> {
                    GatewayRebootSchedule schedule = schedulesByGateway.getOrDefault(
                            gateway.getGatewayId(),
                            new GatewayRebootSchedule(gateway.getGatewayId(), false, DEFAULT_INTERVAL_MINUTES)
                    );
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("gatewayId", gateway.getGatewayId());
                    row.put("ipAddress", gateway.getIpAddress());
                    row.put("enabled", schedule.isEnabled());
                    row.put("intervalMinutes", schedule.getIntervalMinutes());
                    row.put("restarting", gatewayService.isGatewayRestarting(gateway.getGatewayId()));
                    row.put("remainingSeconds", gatewayService.getGatewayRestartRemainingSeconds(gateway.getGatewayId()));
                    return row;
                })
                .toList();
    }

    public GatewayRebootSchedule saveSchedule(String gatewayId, boolean enabled, int intervalMinutes) {
        validateGateway(gatewayId);
        if (intervalMinutes < MIN_INTERVAL_MINUTES) {
            throw new IllegalArgumentException("Interval must be at least 1 minute");
        }

        GatewayRebootSchedule schedule = new GatewayRebootSchedule(gatewayId, enabled, intervalMinutes);
        scheduleDao.save(schedule);

        if (enabled) {
            scheduleReboot(schedule);
        } else {
            cancelReboot(gatewayId);
        }

        return schedule;
    }

    public String restartNow(String gatewayId) {
        Gateway gateway = validateGateway(gatewayId);
        String ipAddress = gateway.getIpAddress();
        if (ipAddress == null || ipAddress.isBlank()) {
            throw new IllegalArgumentException("Gateway IP is required");
        }
        return gatewayService.restartGateway(gatewayId, ipAddress);
    }

    private Gateway validateGateway(String gatewayId) {
        return gatewayService.findById(gatewayId)
                .orElseThrow(() -> new IllegalArgumentException("Gateway not found"));
    }

    private void scheduleReboot(GatewayRebootSchedule schedule) {
        cancelReboot(schedule.getGatewayId());

        ScheduledFuture<?> future = executor.scheduleWithFixedDelay(
                () -> runScheduledReboot(schedule.getGatewayId()),
                schedule.getIntervalMinutes(),
                schedule.getIntervalMinutes(),
                TimeUnit.MINUTES
        );
        scheduledReboots.put(schedule.getGatewayId(), future);
    }

    private void cancelReboot(String gatewayId) {
        Optional.ofNullable(scheduledReboots.remove(gatewayId))
                .ifPresent(future -> future.cancel(false));
    }

    private void runScheduledReboot(String gatewayId) {
        try {
            String message = restartNow(gatewayId);
            logger.info("Scheduled reboot requested for gateway {}: {}", gatewayId, message);
        } catch (Exception e) {
            logger.warn("Unable to run scheduled reboot for gateway {}: {}", gatewayId, e.getMessage());
        }
    }
}
