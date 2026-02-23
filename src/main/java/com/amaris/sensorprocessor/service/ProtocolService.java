package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.Protocol;
import com.amaris.sensorprocessor.repository.ProtocolRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ProtocolService {

    private final ProtocolRepository protocolRepository;

    public ProtocolService(ProtocolRepository protocolRepository) {
        this.protocolRepository = protocolRepository;
    }

    public List<Protocol> findAll() {
        return protocolRepository.findAll(Sort.by(Sort.Direction.ASC, "name"));
    }
}