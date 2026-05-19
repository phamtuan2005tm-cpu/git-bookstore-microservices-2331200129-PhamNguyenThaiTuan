import express from 'express';
import axios from 'axios';
import db from './db.js';
import { connectToBroker, publishMessage } from './broker.js';

const app = express();
app.use(express.json());

// RabbitMQ
connectToBroker().catch(err => console.error('Broker init error', err));

// // Create order
// app.post('/', async (req, res) => {
//   // TODO: Implement order creation with the following steps:
//   // 1. Validate request body:
//   //    - Check productId exists
//   //    - Check quantity is positive
//   // 2. Call product service to verify product exists:
//   //    - Use axios to GET product details
//   //    - Handle timeouts and errors
//   // 3. Insert order into database:
//   //    - Add to orders table with PENDING status
//   // 4. Publish order.created event to message broker:
//   //    - Include order id, product details, quantity
//   // 5. Return success response with order details
// });
// Create order
app.post('/', async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    // 1. Validate request body: Kiểm tra dữ liệu đầu vào
    if (!productId || productId <= 0) {
      return res.status(400).json({ error: 'Valid productId is required' });
    }
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number' });
    }

    // 2. Call product service to verify product exists: Gọi Product Service kiểm tra sách có tồn tại không
    
    let product = {
      title: "IHJALgflLUA",
      price: 23.00
    }
    // try {
    //   // Vì các service chạy trong mạng Docker, ta gọi trực tiếp tên service 'product-service' trên cổng 8002
    //   // const productResponse = await axios.get(`http://product-service:8002/${productId}`, { timeout: 3000 });
    //   //  SỬA LẠI DÒNG AXIOS CHUẨN ĐÉT NÀY TUẤN ƠI:
    //   // Tuấn hãy thử đổi sang dòng này xem sao nhé:
    //   const productResponse = await axios.get(`http://product-service:8002/${productId}`, { timeout: 3000 });
    //   product = productResponse.data;
    // } catch (productErr) {
    //   console.error('Verify product error:', productErr.message);
    //   return res.status(404).json({ error: 'Product not found or Product Service unavailable' });
    // }

    // 3. Insert order into database: Lưu đơn hàng vào Postgres với trạng thái PENDING
    const r = await db.query(
      "INSERT INTO orders (product_id, quantity, status) VALUES ($1, $2, 'PENDING') RETURNING *",
      [productId, quantity]
    );
    const newOrder = r.rows[0];

    // 4. Publish order.created event to message broker: Bắn sự kiện lên trạm RabbitMQ
    const eventPayload = {
      event: 'ORDER_CREATED',
      orderId: newOrder.id,
      productId: productId,
      productTitle: product.title,
      price: product.price,
      quantity: quantity
    };

    // Hàm publishMessage đã được thầy import sẵn ở đầu file từ broker.js
    await publishMessage('order.created', eventPayload);
    console.log(`[RabbitMQ] Successfully published ORDER_CREATED event for Order ID: ${newOrder.id}`);

    // 5. Return success response with order details: Trả về kết quả thành công cho Frontend
    res.status(201).json(newOrder);

  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List orders
app.get('/', async (_req, res) => {
  const r = await db.query('SELECT * FROM orders ORDER BY id DESC');
  res.json(r.rows);
});

// Get order by id
app.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const r = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
  if (r.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
  res.json(r.rows[0]);
});

const PORT = 8003;
app.listen(PORT, () => console.log(`Order Service running on ${PORT}`));
