#!/bin/bash
cd "$(dirname "$0")"
cd frontend
python3 -m http.server 3000