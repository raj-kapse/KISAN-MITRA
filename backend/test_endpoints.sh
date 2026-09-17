#!/bin/bash
echo "1. Testing /api/health"
curl -s http://localhost:5000/api/health | jq
echo -e "\n2. Testing /api/ping"
curl -s http://localhost:5000/api/ping | jq
echo -e "\n3. Testing /api/stores (Valid)"
curl -s "http://localhost:5000/api/stores?lat=19.87&lon=75.34" | jq
echo -e "\n4. Testing /api/weather (Valid)"
curl -s "http://localhost:5000/api/weather?lat=19.87&lon=75.34" | jq
echo -e "\n5. Testing /api/history (No device ID)"
curl -s http://localhost:5000/api/history | jq
echo -e "\n6. Testing /api/geocode (Valid)"
curl -s "http://localhost:5000/api/geocode?q=Nashik" | jq
echo -e "\n7. Testing /api/chat (Empty messages)"
curl -s -X POST -H "Content-Type: application/json" -d '{"messages":[]}' http://localhost:5000/api/chat | jq
echo -e "\n8. Testing /api/diagnose (Missing file)"
curl -s -X POST http://localhost:5000/api/diagnose | jq
echo -e "\n9. Testing /api/diagnose (Empty file - < 1KB)"
touch empty.jpg
curl -s -X POST -F "image=@empty.jpg" http://localhost:5000/api/diagnose | jq
echo -e "\n10. Testing /api/transcribe (Missing file)"
curl -s -X POST http://localhost:5000/api/transcribe | jq
echo -e "\n11. Testing /api/transcribe (Empty file - < 2KB)"
touch empty.mp3
curl -s -X POST -F "audio=@empty.mp3" http://localhost:5000/api/transcribe | jq
