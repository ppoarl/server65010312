const express = require('express');
const axios = require('axios');
const app = express();
const multer = require('multer');
const upload = multer();
const cors = require('cors');

// URL ของ Drone Config Server และ Drone Log Server
const CONFIG_URL = 'https://script.google.com/macros/s/AKfycbzwclqJRodyVjzYyY-NTQDb9cWG6Hoc5vGAABVtr5-jPA_ET_2IasrAJK4aeo5XoONiaA/exec';
const LOG_URL = 'https://app-tracking.pockethost.io/api/collections/drone_logs/records';

// Middleware สำหรับรับข้อมูล JSON
app.use(express.json());
app.use(cors());

app.get('/configs/:id', async (req, res) => {
    const droneId = Number(req.params.id);
    try {
        // ดึงข้อมูลทั้งหมดจาก Drone Config Server
        const response = await axios.get(CONFIG_URL);
        const configs = response.data.data;

        // กรองข้อมูลให้เหลือเฉพาะ config ที่ตรงกับ drone_id ที่ส่งมา
        const config = configs.find(c => c.drone_id === droneId);

        if (!config) {
            return res.status(404).json({ error: "Drone config not found" });
        }

        // ตรวจสอบ max_speed
        if (!config.max_speed) {
            config.max_speed = 100;
        } else if (config.max_speed > 110) {
            config.max_speed = 110;
        }

        // ลบ property 'condition' ออกจาก config
        delete config.condition;

        // ส่ง config ที่ถูกต้องกลับไป
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: "Error fetching drone config" });
    }
});

// 2. GET /status/:id (สถานะของ drone)
app.get('/status/:id', async (req, res) => {
    const droneId = Number(req.params.id);

    try {
        // ดึงข้อมูล log ทั้งหมดจาก Drone Log Server
        const logResponse = await axios.get(CONFIG_URL);
        const logs = logResponse.data.data;

        // ค้นหา log ที่ตรงกับ drone_id
        const droneLog = logs.find(log => log.drone_id === droneId);

        if (!droneLog) {
            return res.status(404).json({ error: "Drone log not found" });
        }

        // ตรวจสอบสถานะ condition ใน log
        const condition = droneLog.condition || "unknown";  // ใช้ค่า "unknown" ถ้าไม่มี condition

        // ส่งข้อมูลสถานะกลับไป
        res.json({
            condition: condition,
        });

    } catch (error) {
        res.status(500).json({ error: "Error fetching drone status" });
    }
});

// 3. GET /logs (ดึง log เฉพาะ drone_id 65010312)
app.get('/logs', async (req, res) => {
    try {
        let allLogs = [];
        let currentPage = 1;
        let hasMoreData = true;
        const droneId = 65010312; // กำหนด droneId ที่ต้องการกรอง

        while (hasMoreData) {
            // เรียก API โดยใช้ currentPage
            const response = await axios.get(`${LOG_URL}?page=${currentPage}`);
            const logs = response.data.items; // ปรับให้ตรงกับโครงสร้าง response ของ API

            // ตรวจสอบว่าข้อมูลมีอยู่จริงก่อนที่จะทำการกรอง
            if (logs && logs.length > 0) {
                // กรอง log ที่มี drone_id ตรงกับ droneId ที่เราต้องการ
                const filteredLogs = logs.filter(log => log.drone_id === droneId);

                // เพิ่ม log ที่กรองแล้วลงใน allLogs
                allLogs = allLogs.concat(filteredLogs);

                // ตรวจสอบว่ามีข้อมูลเพิ่มเติมหรือไม่
                currentPage++; // ไปยังหน้าถัดไป
            } else {
                hasMoreData = false; // ไม่มีข้อมูลเพิ่มเติม
            }
        }

        // ส่งข้อมูลทั้งหมดที่กรองแล้วกลับไปที่ client
        res.json(allLogs);
    } catch (error) {
        console.error("Error fetching drone logs:", error.message);
        res.status(500).json({ error: "Error fetching drone logs" });
    }
});

// 4. POST /logs (เพิ่ม log ใหม่)
app.post("/POST/logs", upload.none(), async (req, res) => {
    // ตรวจสอบว่ามีค่า celsius อยู่ใน request body หรือไม่
    if (!req.body.celsius) {
        return res.status(400).send("Please provide the celsius value");
    }

    const celsius = req.body.celsius;

    try {
        // สร้างข้อมูล log ที่จะส่งไปยัง API
        const logData = {
            drone_id: '65010312',        // กำหนด drone_id เป็น 65010312
            drone_name: 'Natthapak',     // กำหนด drone_name เป็น Natthapak
            country: 'Thailand',         // กำหนด country เป็น Thailand
            celsius: celsius             // รับค่า celsius จาก request body
        };

        // ส่งข้อมูลไปยัง Drone Log Server (API)
        const { data } = await axios.post(LOG_URL, logData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // แสดงข้อมูลใน console และส่ง response กลับไปยัง client
        console.log("Data generated: ", data);
        res.status(200).json({
            message: "Insert complete",
            input_celsius: celsius,
            generated_data: data
        });
    } catch (error) {
        // แสดงข้อผิดพลาดใน console และส่ง response กลับไปยัง client
        console.error("Error: ", error.message);
        res.status(500).send("Error handling the data");
    }
});

// Export app สำหรับ Vercel
module.exports = app;
