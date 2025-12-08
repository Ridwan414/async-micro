VERSION=v1
REGISTRY=asifmahmoud414

build:
	docker compose build

up:
	docker compose up -d
	@echo "Services are starting..."
	@echo "Gateway: http://localhost:3000"
	@echo "Backend: http://localhost:8000"
	@echo "Product: http://localhost:8001"
	@echo "RabbitMQ UI: http://localhost:15672 (admin/admin)"

down:
	docker compose down

build-worker:
	docker build -t $(REGISTRY)/worker-service:$(VERSION) services/worker
push-worker:
	docker push $(REGISTRY)/worker-service:$(VERSION)

build-api:
	docker build -t $(REGISTRY)/api-service:$(VERSION) services/backend
push-api:
	docker push $(REGISTRY)/api-service:$(VERSION)

build-product:
	docker build -t $(REGISTRY)/product-service:$(VERSION) services/product
push-product:
	docker push $(REGISTRY)/product-service:$(VERSION)

build-gateway:
	docker build -t $(REGISTRY)/gateway-service:$(VERSION) services/gateway
push-gateway:
	docker push $(REGISTRY)/gateway-service:$(VERSION)

build-all: build-worker build-api build-product build-gateway
push-all: push-worker push-api push-product push-gateway
