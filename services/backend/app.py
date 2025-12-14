from flask import Flask, request, jsonify
from prometheus_flask_exporter import PrometheusMetrics
import pika
import json
import os

app = Flask(__name__)
metrics = PrometheusMetrics(app)

RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "rabbitmq")
RABBITMQ_USER = os.getenv("RABBITMQ_USER", "admin")
RABBITMQ_PASS = os.getenv("RABBITMQ_PASS", "admin")
QUEUE_NAME = "task-queue"

@app.route('/task', methods=['POST'])
def create_task():
    data = request.get_json()
    
    credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
    parameters = pika.ConnectionParameters(
        host=RABBITMQ_HOST,
        credentials=credentials
    )
    connection = pika.BlockingConnection(parameters)
    channel = connection.channel()
    channel.queue_declare(queue=QUEUE_NAME, durable=True)
    
    message = json.dumps(data)
    channel.basic_publish(exchange='', routing_key=QUEUE_NAME, body=message)
    
    connection.close()
    
    return jsonify({"status": "Task submitted", "message": data}), 202

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)
