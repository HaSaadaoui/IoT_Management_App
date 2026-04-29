package com.amaris.sensorprocessor.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;

@Component
@RequiredArgsConstructor
@Slf4j
public class OccupancyAnalyticsScheduler {

    private static final ZoneId PARIS_ZONE = ZoneId.of("Europe/Paris");

    private final OccupancyAnalyticsService occupancyAnalyticsService;

    @Scheduled(cron = "0 0 0 * * *", zone = "Europe/Paris")
    public void cachePreviousWorkingDayOccupancyAtMidnight() {
        LocalDate targetDay = LocalDate.now(PARIS_ZONE).minusDays(1);
        log.info("Running midnight occupancy cache refresh for {}", targetDay);
        occupancyAnalyticsService.refreshCachedDailyOccupancyForDate(targetDay);
    }
}
