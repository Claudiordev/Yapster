# Webphone - Automated Polymarket Trading Platform

Webphone is an automated trading platform that monitors real-time Bitcoin price movements and executes trades on [Polymarket](https://polymarket.com) prediction markets. It targets BTC 5-minute price direction markets, using configurable thresholds to detect significant price swings and place orders accordingly.

## How It Works

The platform streams live BTC/USD prices via Chainlink WebSocket feeds and continuously analyzes price movements within rolling 5-minute time blocks. When a price change exceeds a configured threshold within a specified time window, the system automatically places a buy order on the corresponding Polymarket prediction market (Up or Down), then monitors the position for stop-loss or take-profit exits.

### Threshold Detection

Time is divided into consecutive 5-minute blocks. At the start of each block, the current BTC price is captured as the **target price**. The system then watches for significant deviations:

- **Price Threshold** &mdash; The minimum price difference (in USD) between the current price and the target price required to trigger a trade. For example, a threshold of `$100` means a trade is triggered only if BTC moves at least $100 within the block.
- **Time Threshold** &mdash; A time window (in milliseconds) at the end of each 5-minute block during which threshold checks are active. For example, `30000ms` means the system only evaluates price changes in the last 30 seconds of each block.

When both conditions are met (price moved enough, within the time window), a **hit event** is fired and an order is placed automatically.

All threshold parameters can be adjusted at runtime via the REST API or the web interface — no restart required.

### Trading & Position Management

Once a threshold hit is detected:

1. A **BUY** order is placed on Polymarket's CLOB (Central Limit Order Book) for the matching Up or Down token.
2. The position is tracked and a WebSocket connection is opened to the Polymarket order book to monitor the position's price in real time.
3. **Stop-Loss** &mdash; If the best bid drops below the entry price by a configurable percentage, the position is automatically sold.
4. **Take-Profit** &mdash; If the best bid rises above the entry price by a configurable percentage, the position is automatically sold.
5. Hit events are published to Kafka for historical tracking and analytics.

All orders are cryptographically signed using EIP-712 signatures on the Polygon network, supporting both direct wallet (EOA) and proxy contract signing modes.

### Configuration Example

| Parameter | Description | Default |
|-----------|-------------|---------|
| `priceThreshold` | Minimum price movement in USD | `100.0` |
| `timeThreshold` | Active detection window (ms) before block end | `30000` |
| `stopLossPercent` | Stop-loss exit percentage | `20.0%` |
| `takeProfitPercent` | Take-profit exit percentage | `20.0%` |

## Tech Stack

### Backend

- **Java 21** with **Spring Boot 3.5.5**
- **Spring Cloud 2025.0.0** &mdash; Eureka service discovery, Cloud Gateway for routing
- **Spring Kafka** &mdash; Event streaming for hit events and analytics
- **Web3j 4.12.3** &mdash; Ethereum/Polygon cryptographic signing
- **PostgreSQL 16** &mdash; Persistent storage
- **JJWT** &mdash; JWT-based authentication

### Frontend

- **Next.js 15** with **React 18** and **TypeScript**
- **Tailwind CSS** &mdash; Utility-first styling
- **HeroUI v2** &mdash; Component library
- **Framer Motion** &mdash; Animations

### Infrastructure

- **Apache Kafka** &mdash; Event streaming between services
- **Polygon Mainnet** (Chain ID 137) &mdash; On-chain order signing
- **Docker Compose** &mdash; Local development orchestration

## Getting Started

### Prerequisites

- Java 21
- Node.js 18+
- Docker & Docker Compose
- A Polymarket-compatible wallet with a private key

### Running Locally

Start the infrastructure services with all the backend services:

```bash
docker-compose up -d
```

Start the frontend:

```bash
cd web
npm install
npm run dev
```

## REST API

The trading module exposes the following endpoints under `/api/v1/trading`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/status` | WebSocket connection status |
| `GET` | `/hits` | All detected threshold hits |
| `GET` | `/orders` | All placed orders |
| `GET` | `/settings` | Current threshold configuration |
| `PUT` | `/settings` | Update thresholds at runtime |
| `GET` | `/positions` | Open and closed positions |
| `GET` | `/balance` | Account token balance |
| `POST` | `/connect` | Manually reconnect WebSocket |
| `POST` | `/order` | Manually place an order |
