#!/usr/bin/bash

# Hiting endpoint with curl
curl -X POST http://localhost:5000/api/questions \
     -H "Content-Type: application/json" \
     -d '{"text": "How do I configure my Podman container mapping?"}'


# Listout end point check with this command
curl -X GET http://localhost:5000/api/questions

