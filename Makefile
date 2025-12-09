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

# ===================
# PRODUCTION DEPLOYMENT
# ===================

prod-up:
	docker compose -f docker-compose.prod.yml up -d
	@echo ""
	@echo "=== Production Stack Started ==="
	@echo ""
	@echo "Application Services:"
	@echo "  Gateway:     http://localhost:3000"
	@echo "  Backend:     http://localhost:8000"
	@echo "  Product:     http://localhost:8001"
	@echo "  RabbitMQ:    http://localhost:15672 (admin/admin)"
	@echo ""
	@echo "Observability Stack:"
	@echo "  Grafana:     http://localhost:3001 (admin/admin)"
	@echo "  Prometheus:  http://localhost:9090"
	@echo "  Jaeger:      http://localhost:16686"
	@echo "  Loki:        http://localhost:3100"
	@echo ""

prod-down:
	docker compose -f docker-compose.prod.yml down

prod-logs:
	docker compose -f docker-compose.prod.yml logs -f

# ===================
# KUBERNETES DEPLOYMENT
# ===================

k8s-deploy:
	kubectl apply -f manifests/

k8s-delete:
	kubectl delete -f manifests/

k8s-status:
	kubectl get pods,svc,deployments

# ===================
# ARGO CD
# ===================

argocd-install:
	chmod +x argocd/install-argocd.sh
	./argocd/install-argocd.sh

argocd-ui:
	@echo "Opening Argo CD UI..."
	@echo "Username: admin"
	@echo "Password: (see output above)"
	kubectl port-forward svc/argocd-server -n argocd 8080:443

# ===================
# LOAD TESTING
# ===================

load-test:
	k6 run load-tests/load-test.js

stress-test:
	k6 run load-tests/stress-test.js

# ===================
# DEVELOPMENT
# ===================

logs:
	docker compose logs -f

restart:
	docker compose restart

clean:
	docker compose down -v
	docker system prune -f
