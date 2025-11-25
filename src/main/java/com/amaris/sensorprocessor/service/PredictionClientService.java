package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.model.prediction.PredictionResponse;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;

@Service
public class PredictionClientService {

    private final RestTemplate restTemplate = new RestTemplate();

    // базовый URL FastAPI
    private final String pythonApiUrl = "http://172.205.172.248:8000/predict";

    /**
     * Запрос на FastAPI с горизонтом.
     * Ожидаем, что Python обрабатывает параметр ?horizon=1h/1d/1w/1m/3m
     */
    public PredictionResponse getPrediction(String horizon) {
        try {
            URI uri = UriComponentsBuilder
                    .fromHttpUrl(pythonApiUrl)
                    .queryParam("horizon", horizon)
                    .build()
                    .toUri();

            return restTemplate.getForObject(uri, PredictionResponse.class);
        } catch (Exception e) {
            // пока просто логируем стек трейс, чтобы видеть проблему
            e.printStackTrace();
            throw e;
        }
    }
}
