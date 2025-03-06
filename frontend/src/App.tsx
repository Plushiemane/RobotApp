import { useState, useEffect, useCallback } from 'react'
import './App.css'

function App() {
    const [connected, setConnected] = useState(false)
    const [leftEngine, setLeftEngine] = useState(0)
    const [rightEngine, setRightEngine] = useState(0)
    const [led1, setLed1] = useState(false)
    const [led2, setLed2] = useState(false)
    const [robotIp, setRobotIp] = useState("100.105.5.12:3000")
    const [responseMessage, setResponseMessage] = useState("")
    const [batteryVoltage, setBatteryVoltage] = useState(0)
    const [sensorValues, setSensorValues] = useState<number[]>([])

    const handleConnect = async () => {
        try {
            // Ping the robot with a GET request
            const response = await fetch(`http://${robotIp}`);
            if(response.ok){
                setConnected(true)
                const text = await response.text();
                setResponseMessage(text);
                console.log(`Connected to robot at ${robotIp}`)
            } else {
                const text = await response.text();
                setResponseMessage(`Error: ${text}`);
                console.error('Ping failed')
            }
        } catch (error) {
            setResponseMessage(`Connection error: ${error instanceof Error ? error.message : String(error)}`);
            console.error('Ping error:', error)
        }
    }

    const handleMoveForward = () => {
        setLeftEngine(50)
        setRightEngine(50)
    }

    const handleMoveBackward = () => {
        setLeftEngine(-50)
        setRightEngine(-50)
    }

    const handleStop = () => {
        setLeftEngine(0)
        setRightEngine(0)
    }

    // Parse robot response format
    const parseRobotResponse = (response: string) => {
        // Remove brackets if present
        const cleanResponse = response.replace(/[[\]]]/g, '');
        
        if (cleanResponse.length < 6) return; // Not enough data
        
        // Status is the first 2 characters (unused)
        // const status = parseInt(cleanResponse.substring(0, 2), 16);
        
        // Battery voltage is the next 4 characters
        const batteryHex = cleanResponse.substring(2, 6);
        const battery = parseInt(batteryHex, 16);
        
        // Convert to millivolts (if needed)
        setBatteryVoltage(battery);
        
        // Parse sensor values if available
        const sensorData = cleanResponse.substring(6);
        const sensors: number[] = [];
        
        for (let i = 0; i < sensorData.length; i += 4) {
            if (i + 4 <= sensorData.length) {
                const sensorHex = sensorData.substring(i, i + 4);
                const sensorValue = parseInt(sensorHex, 16);
                sensors.push(sensorValue);
            }
        }
        
        setSensorValues(sensors);
    }

    const sendControlFrame = useCallback(async () => {
        if (!connected) return;
        
        try {
            // Simplified frame format based on example: [Led1Led2LeftMotorRightMotor]
            
            // Convert LED values (0 or 1)
            const led1Value = led1 ? '1' : '0';
            const led2Value = led2 ? '1' : '0';
            
            // Convert motor values to 2-digit hex (0-255 range)
            // Handle negative values by adding offset (e.g., -50 becomes 206)
            const normalizedLeftEngine = leftEngine < 0 ? 256 + leftEngine : leftEngine;
            const normalizedRightEngine = rightEngine < 0 ? 256 + rightEngine : rightEngine;
            
            // Convert to 2-digit hex and ensure leading zeros
            const leftEngineHex = normalizedLeftEngine.toString(16).padStart(2, '0');
            const rightEngineHex = normalizedRightEngine.toString(16).padStart(2, '0');
            
            // Assemble the simplified frame
            const frameData = `${led1Value}${led2Value}${leftEngineHex}${rightEngineHex}`;
            const frame = `[${frameData}]`;
            
            console.log(`Sending frame: ${frame}`);
            
            const response = await fetch(`http://${robotIp}`, {
                method: "POST",
                headers: { "Content-Type": "text/plain" },
                body: frame
            });
            
            if(response.ok){
                const text = await response.text();
                setResponseMessage(text);
                console.log("Control frame sent successfully:", text);
                
                // Parse the robot's response
                if (text && text.includes('[')) {
                    parseRobotResponse(text);
                }
            } else {
                const text = await response.text();
                setResponseMessage(`Error: ${text}`);
                console.error("Failed to send control frame:", text);
            }
        } catch (error) {
            if (error instanceof Error) {
                setResponseMessage(`Error sending frame: ${error.message}`);
            } else {
                setResponseMessage("Error sending frame: Unknown error");
            }
            console.error("Error sending frame:", error);
        }
    }, [robotIp, led1, led2, leftEngine, rightEngine, connected]);

    // Send frame when LED states or engine values change
    useEffect(() => {
        if (connected) {
            sendControlFrame();
        }
    }, [led1, led2, leftEngine, rightEngine, connected, sendControlFrame]);

    const toggleLed1 = () => {
        setLed1(!led1);
    }
    
    const toggleLed2 = () => {
        setLed2(!led2);
    }

    return (
        <div className="app-container">
            <h1>Robot Controller</h1>
            
            {/* Robot IP Input */}
            <div className="ip-input">
                <label>Robot IP: </label>
                <input 
                    type="text" 
                    value={robotIp} 
                    onChange={(e) => setRobotIp(e.target.value)} 
                />
                <button onClick={handleConnect}>Connect Robot</button>
            </div>
            
            <div className="controls" style={{ display: connected ? 'block' : 'none' }}>
                <div className="movement-controls">
                    <button onClick={handleMoveForward}>Forward</button>
                    <button onClick={handleStop}>Stop</button>
                    <button onClick={handleMoveBackward}>Backward</button>
                </div>
                
                {/* Left Engine Slider */}
                <div className="engine-control">
                    <label>Left Engine: {leftEngine}</label>
                    <input 
                        type="range" 
                        min="-100" 
                        max="100" 
                        value={leftEngine} 
                        onChange={(e) => setLeftEngine(Number(e.target.value))} 
                    />
                </div>
                
                <div className="led-controls">
                    <button 
                        className='card' 
                        style={{backgroundColor: led1 ? '#4CAF50' : '#f44336'}} 
                        onClick={toggleLed1}
                    >
                        LED 1 {led1 ? 'ON' : 'OFF'}
                    </button>
                    <button 
                        className='card' 
                        style={{backgroundColor: led2 ? '#4CAF50' : '#f44336'}} 
                        onClick={toggleLed2}
                    >
                        LED 2 {led2 ? 'ON' : 'OFF'}
                    </button>
                </div>
                
                {/* Right Engine Slider */}
                <div className="engine-control">
                    <label>Right Engine: {rightEngine}</label>
                    <input 
                        type="range" 
                        min="-100" 
                        max="100" 
                        value={rightEngine} 
                        onChange={(e) => setRightEngine(Number(e.target.value))} 
                    />
                </div>
                
                {/* Sensor Data Display */}
                <div className="sensor-data">
                    <h3>Robot Data</h3>
                    <p>Battery: {batteryVoltage} mV</p>
                    <div className="sensor-values">
                        {sensorValues.map((value, index) => (
                            <p key={index}>Sensor {index+1}: {value}</p>
                        ))} 
                    </div>
                </div>
            </div>
            
            <div className="status">
                <p>{connected ? `Connected to robot at ${robotIp}` : "Not Connected"}</p>
                <p>Response: {responseMessage}</p>
            </div>
        </div>
    )
}

export default App
