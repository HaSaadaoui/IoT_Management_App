package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.model.prediction.PredictionResponse;
import com.amaris.sensorprocessor.model.prediction.T0ListResponse;
import com.amaris.sensorprocessor.model.prediction.HistoricalResponse;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;

@Service
public class PredictionClientService {

    private final RestTemplate restTemplate = new RestTemplate();

    // базовый URL FastAPI (без /predict)
    private final String pythonBaseUrl = "http://172.205.172.248:8000";

    // старый онлайн-эндпойнт
    private final String pythonOnlineUrl = pythonBaseUrl + "/predict";

    /**
     * Online: /predict?horizon=...
     */
    public PredictionResponse getPrediction(String horizon) {
        try {
            URI uri = UriComponentsBuilder
                    .fromUriString(pythonOnlineUrl)
                    .queryParam("horizon", horizon)
                    .build()
                    .toUri();

            return restTemplate.getForObject(uri, PredictionResponse.class);
        } catch (Exception e) {
            e.printStackTrace();
            throw e;
        }
    }

    /**
     * Historical: /prediction/historical/t0-list?horizon=...
     */
    public T0ListResponse getHistoricalT0List(String horizon) {
        try {
            URI uri = UriComponentsBuilder
                    .fromUriString(pythonBaseUrl + "/prediction/historical/t0-list")
                    .queryParam("horizon", horizon)
                    .build(true)
                    .toUri();

            return restTemplate.getForObject(uri, T0ListResponse.class);
        } catch (Exception e) {
            e.printStackTrace();
            throw e;
        }
    }


    /**
     * Historical: /predict/historical?horizon=...&t0=...
     */
    public HistoricalResponse getHistoricalPrediction(String horizon, String t0Iso) {
        try {
            URI uri = UriComponentsBuilder
                    .fromUriString(pythonBaseUrl + "/predict/historical")
                    .queryParam("horizon", horizon)
                    .queryParam("t0", t0Iso)
                    .build()
                    .toUri();

            return restTemplate.getForObject(uri, HistoricalResponse.class);
        } catch (Exception e) {
            e.printStackTrace();
            throw e;
        }
    }
}
