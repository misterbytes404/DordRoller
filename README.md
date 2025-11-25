# Dord Roller: Twitch D&D Stream Manager

A modular, real-time web application suite for managing D&D games on Twitch streams.

## Project Structure

```
DordRoller/
├── backend/          # Node.js server with Express & Socket.io
├── gm-client/        # GM control panel web app
├── player-client/    # Player remote interface web app
├── obs-client/       # OBS browser source display
└── shared/           # Shared utilities and types
```

## Technology Stack

- **Backend**: Node.js, Express.js, Socket.io, SQLite
- **Frontend**: Modern JavaScript (ES6+)
- **Real-time**: WebSocket via Socket.io

## Attributions

This project incorporates parsing logic inspired by the 5etools project (https://github.com/5etools-mirror-3/5etools-src), which is licensed under the MIT License. The original project provides comprehensive D&D tools and data.

## Development Roadmap

1. **MVP 1**: GM-to-OBS Dice Roller
2. **MVP 2**: GM Stat Tracker
3. **MVP 3**: Player Client Integration

## Contributors

<!--
Source - https://stackoverflow.com/a
Posted by Bertrand Martel
Retrieved 2025-11-15, License - CC BY-SA 4.0
-->

<a href="https://github.com/misterbytes404/dordroller/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=misterbytes404/dordroller" />
</a>
