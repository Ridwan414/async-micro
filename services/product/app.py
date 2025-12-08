from flask import Flask, request, jsonify
from datetime import datetime
import uuid

app = Flask(__name__)

# In-memory database
products_db = {}

# Seed some initial data
def seed_data():
    products = [
        {
            "id": str(uuid.uuid4()),
            "name": "Laptop",
            "description": "High-performance laptop",
            "price": 999.99,
            "stock": 50,
            "created_at": datetime.now().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Wireless Mouse",
            "description": "Ergonomic wireless mouse",
            "price": 29.99,
            "stock": 200,
            "created_at": datetime.now().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Mechanical Keyboard",
            "description": "RGB mechanical keyboard",
            "price": 149.99,
            "stock": 75,
            "created_at": datetime.now().isoformat()
        }
    ]
    
    for product in products:
        products_db[product["id"]] = product

seed_data()

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "ok",
        "service": "product",
        "products_count": len(products_db)
    }), 200

@app.route('/products', methods=['GET'])
def get_products():
    """Get all products with optional filtering"""
    min_price = request.args.get('min_price', type=float)
    max_price = request.args.get('max_price', type=float)
    in_stock = request.args.get('in_stock', type=bool)
    
    products = list(products_db.values())
    
    # Apply filters
    if min_price is not None:
        products = [p for p in products if p['price'] >= min_price]
    
    if max_price is not None:
        products = [p for p in products if p['price'] <= max_price]
    
    if in_stock is not None:
        products = [p for p in products if (p['stock'] > 0) == in_stock]
    
    return jsonify({
        "count": len(products),
        "products": products
    }), 200

@app.route('/products/<product_id>', methods=['GET'])
def get_product(product_id):
    """Get a specific product by ID"""
    product = products_db.get(product_id)
    
    if not product:
        return jsonify({
            "error": "Product not found",
            "product_id": product_id
        }), 404
    
    return jsonify(product), 200

@app.route('/products', methods=['POST'])
def create_product():
    """Create a new product"""
    data = request.get_json()
    
    # Validation
    required_fields = ['name', 'price']
    for field in required_fields:
        if field not in data:
            return jsonify({
                "error": f"Missing required field: {field}"
            }), 400
    
    # Create new product
    product_id = str(uuid.uuid4())
    product = {
        "id": product_id,
        "name": data['name'],
        "description": data.get('description', ''),
        "price": float(data['price']),
        "stock": data.get('stock', 0),
        "created_at": datetime.now().isoformat()
    }
    
    products_db[product_id] = product
    
    return jsonify(product), 201

@app.route('/products/<product_id>', methods=['PUT'])
def update_product(product_id):
    """Update an existing product"""
    if product_id not in products_db:
        return jsonify({
            "error": "Product not found",
            "product_id": product_id
        }), 404
    
    data = request.get_json()
    product = products_db[product_id]
    
    # Update fields
    if 'name' in data:
        product['name'] = data['name']
    if 'description' in data:
        product['description'] = data['description']
    if 'price' in data:
        product['price'] = float(data['price'])
    if 'stock' in data:
        product['stock'] = data['stock']
    
    product['updated_at'] = datetime.now().isoformat()
    
    return jsonify(product), 200

@app.route('/products/<product_id>', methods=['DELETE'])
def delete_product(product_id):
    """Delete a product"""
    if product_id not in products_db:
        return jsonify({
            "error": "Product not found",
            "product_id": product_id
        }), 404
    
    deleted_product = products_db.pop(product_id)
    
    return jsonify({
        "message": "Product deleted successfully",
        "product": deleted_product
    }), 200

@app.route('/products/<product_id>/stock', methods=['PATCH'])
def update_stock(product_id):
    """Update product stock"""
    if product_id not in products_db:
        return jsonify({
            "error": "Product not found",
            "product_id": product_id
        }), 404
    
    data = request.get_json()
    
    if 'quantity' not in data:
        return jsonify({
            "error": "Missing required field: quantity"
        }), 400
    
    product = products_db[product_id]
    old_stock = product['stock']
    product['stock'] = max(0, old_stock + data['quantity'])
    product['updated_at'] = datetime.now().isoformat()
    
    return jsonify({
        "message": "Stock updated",
        "old_stock": old_stock,
        "new_stock": product['stock'],
        "product": product
    }), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8001)

