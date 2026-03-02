package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.Protocol;
import com.amaris.sensorprocessor.repository.ProtocolRepository;
import org.springframework.dao.DataIntegrityViolationException;
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

    public Protocol createByName(String name) {
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("Protocol name is required");
        }

        String cleaned = name.trim();

        Protocol protocol = new Protocol();
        protocol.setName(cleaned);

        try {
            return protocolRepository.save(protocol);
        } catch (DataIntegrityViolationException e) {
            throw new IllegalStateException("Protocol already exists: " + cleaned);
        }
    }

    public void deleteById(Integer id) {
        protocolRepository.deleteById(id);
    }
}