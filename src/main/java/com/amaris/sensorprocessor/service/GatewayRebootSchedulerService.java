package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.Gateway;
import com.amaris.sensorprocessor.entity.GatewayRebootSchedule;
import com.amaris.sensorprocessor.repository.GatewayRebootScheduleDao;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
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

    private static final int DEFAULT_DAY_OF_WEEK = 1;
    private static final LocalTime DEFAULT_REBOOT_TIME = LocalTime.of(0, 0);
    private static final ZoneId REBOOT_ZONE = ZoneId.of("Europe/Paris");

    private final Logger logger = LoggerFactory.getLogger(this.getClass());
    private final GatewayRebootScheduleDao scheduleDao;
    private final GatewayService gatewayService;
    private final ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor();
    private final Map<String, ScheduledFuture<?>> scheduledReboots = new ConcurrentHashMap<>();
    private final Map<String, GatewayRebootSchedule> activeSchedules = new ConcurrentHashMap<>();

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
                            new GatewayRebootSchedule(gateway.getGatewayId(), false, DEFAULT_DAY_OF_WEEK, DEFAULT_REBOOT_TIME)
                    );
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("gatewayId", gateway.getGatewayId());
                    row.put("ipAddress", gateway.getIpAddress());
                    row.put("enabled", schedule.isEnabled());
                    row.put("dayOfWeek", schedule.getDayOfWeek());
                    row.put("rebootTime", schedule.getRebootTime().format(DateTimeFormatter.ofPattern("HH:mm")));
                    row.put("restarting", gatewayService.isGatewayRestarting(gateway.getGatewayId()));
                    row.put("remainingSeconds", gatewayService.getGatewayRestartRemainingSeconds(gateway.getGatewayId()));
                    return row;
                })
                .toList();
    }

    public GatewayRebootSchedule saveSchedule(String gatewayId, boolean enabled, int dayOfWeek, LocalTime rebootTime) {
        validateGateway(gatewayId);
        if (dayOfWeek < 0 || dayOfWeek > 6) {
            throw new IllegalArgumentException("dayOfWeek must be between 0 and 6");
        }

        GatewayRebootSchedule schedule = new GatewayRebootSchedule(gatewayId, enabled, dayOfWeek, rebootTime);
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
        activeSchedules.put(schedule.getGatewayId(), schedule);
        scheduleNextReboot(schedule, true);
    }

    private void scheduleNextReboot(GatewayRebootSchedule schedule, boolean allowCurrentMinute) {
        if (activeSchedules.get(schedule.getGatewayId()) != schedule) {
            return;
        }

        ZonedDateTime now = ZonedDateTime.now(REBOOT_ZONE);
        ZonedDateTime nextReboot = calculateNextReboot(now, schedule.getDayOfWeek(), schedule.getRebootTime(), allowCurrentMinute);
        long initialDelay = Math.max(0, Duration.between(now, nextReboot).toMillis());

        logger.info("Gateway {} next scheduled reboot at {}", schedule.getGatewayId(), nextReboot);

        ScheduledFuture<?> future = executor.schedule(
                () -> runScheduledReboot(schedule),
                initialDelay,
                TimeUnit.MILLISECONDS
        );
        scheduledReboots.put(schedule.getGatewayId(), future);
    }

    static ZonedDateTime calculateNextReboot(ZonedDateTime now, int dayOfWeek, LocalTime rebootTime, boolean allowCurrentMinute) {
        DayOfWeek target = dayOfWeek == 0
                ? DayOfWeek.SUNDAY
                : DayOfWeek.of(dayOfWeek);

        ZonedDateTime nextReboot = now.toLocalDate()
                .atTime(rebootTime)
                .atZone(now.getZone())
                .with(TemporalAdjusters.nextOrSame(target));

        if (allowCurrentMinute && nextReboot.plusMinutes(1).isAfter(now)) {
            return nextReboot.isAfter(now) ? nextReboot : now;
        }

        if (!nextReboot.isAfter(now)) {
            nextReboot = nextReboot.plusWeeks(1);
        }

        return nextReboot;
    }

    private void cancelReboot(String gatewayId) {
        activeSchedules.remove(gatewayId);
        Optional.ofNullable(scheduledReboots.remove(gatewayId))
                .ifPresent(future -> future.cancel(false));
    }

    private void runScheduledReboot(GatewayRebootSchedule schedule) {
        String gatewayId = schedule.getGatewayId();
        try {
            String message = restartNow(gatewayId);
            logger.info("Scheduled reboot requested for gateway {}: {}", gatewayId, message);
        } catch (Exception e) {
            logger.warn("Unable to run scheduled reboot for gateway {}: {}", gatewayId, e.getMessage());
        } finally {
            if (activeSchedules.get(gatewayId) == schedule) {
                scheduleNextReboot(schedule, false);
            }
        }
    }
}
