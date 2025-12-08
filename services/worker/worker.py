import pika
import json
import time
import os

RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "rabbitmq")
RABBITMQ_USER = os.getenv("RABBITMQ_USER", "admin")
RABBITMQ_PASS = os.getenv("RABBITMQ_PASS", "admin")
QUEUE_NAME = "task-queue"

def process_task(ch, method, properties, body):
    data = json.loads(body)
    print(f"Processing task: {data}")
    
    # Simulate work
    time.sleep(5)
    
    print(f"Task completed: {data}")
    ch.basic_ack(delivery_tag=method.delivery_tag)

credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
parameters = pika.ConnectionParameters(
    host=RABBITMQ_HOST,
    credentials=credentials
)
connection = pika.BlockingConnection(parameters)
channel = connection.channel()
channel.queue_declare(queue=QUEUE_NAME, durable=True)
channel.basic_qos(prefetch_count=1)
channel.basic_consume(queue=QUEUE_NAME, on_message_callback=process_task)

print("Worker waiting for tasks...")
channel.start_consuming()
