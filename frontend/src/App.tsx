import { useState, useEffect, useCallback, useRef } from 'react'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
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
  const [connectionError, setConnectionError] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [pendingUpdate, setPendingUpdate] = useState(false)
  const sliderTimeoutRef = useRef<number | null>(null)

  const handleConnect = async () => {
    try {
      const response = await fetch(`http://${robotIp}`)
      if(response.ok){
        setConnected(true)
        setConnectionError(false)
        const text = await response.text()
        setResponseMessage(text)
        toast.success(`Połączono z robotem ${robotIp}`)
        console.log(`Connected to robot at ${robotIp}`)
      } else {
        setConnected(false)
        setConnectionError(true)
        const text = await response.text()
        setResponseMessage(`Error: ${text}`)
        toast.error(`Błąd: ${text}`)
        console.error('Ping failed')
      }
    } catch (error) {
      setConnected(false)
      setConnectionError(true)
      const errorMsg = error instanceof Error ? error.message : String(error)
      setResponseMessage(`Connection error: ${errorMsg}`)
      toast.error(`Błąd połączenia: ${errorMsg}`)
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

  const handleMoveLeft = () => {
    // Skręt w lewo: lewy silnik do tyłu, prawy do przodu
    setLeftEngine(-50)
    setRightEngine(50)
  }

  const handleMoveRight = () => {
    // Skręt w prawo: lewy silnik do przodu, prawy do tyłu
    setLeftEngine(50)
    setRightEngine(-50)
  }

  const parseRobotResponse = (response: string) => {
    const cleanResponse = response.replace(/[[\]]/g, '')
    if (cleanResponse.length < 6) return
    const batteryHex = cleanResponse.substring(2, 6)
    const battery = parseInt(batteryHex, 16)
    setBatteryVoltage(battery)
    const sensorData = cleanResponse.substring(6)
    const sensors = []
    for (let i = 0; i < sensorData.length; i += 4) {
      if(i + 4 <= sensorData.length) {
        const sensorHex = sensorData.substring(i, i + 4)
        const sensorValue = parseInt(sensorHex, 16)
        sensors.push(sensorValue)
      }
    }
    setSensorValues(sensors)
  }

  const sendControlFrame = useCallback(async () => {
    if (!connected) return

    try {
      const led1Value = led1 ? '1' : '0'
      const led2Value = led2 ? '1' : '0'
      const normalizedLeftEngine = leftEngine < 0 ? 256 + leftEngine : leftEngine
      const normalizedRightEngine = rightEngine < 0 ? 256 + rightEngine : rightEngine
      const leftEngineHex = normalizedLeftEngine.toString(16).padStart(2, '0')
      const rightEngineHex = normalizedRightEngine.toString(16).padStart(2, '0')
      const frameData = `${led1Value}${led2Value}${leftEngineHex}${rightEngineHex}`
      const frame = `[${frameData}]`
      console.log(`Sending frame: ${frame}`)
      const response = await fetch(`http://${robotIp}`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: frame
      })
      if(response.ok){
        if (connectionError) {
          setConnectionError(false)
        }
        const text = await response.text()
        setResponseMessage(text)
        console.log("Frame sent successfully:", text)
        if (text && text.includes('[')) {
          parseRobotResponse(text)
        }
      } else {
        const text = await response.text()
        setResponseMessage(`Error: ${text}`)
        if (!connectionError) {
          toast.error(`Błąd wysyłania: ${text}`)
        }
        setConnectionError(true)
        console.error("Failed to send control frame:", text)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error"
      setResponseMessage(`Error sending frame: ${errorMsg}`)
      if (!connectionError) {
        toast.error(`Błąd wysyłania: ${errorMsg}`)
      }
      setConnectionError(true)
      console.error("Error sending frame:", error)
    }
  }, [robotIp, led1, led2, leftEngine, rightEngine, connected, connectionError])

  // Add document level event listeners for mouse up to handle dragging ending outside the slider
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setPendingUpdate(true);
        sendControlFrame();
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('touchend', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, [isDragging, sendControlFrame]);

  useEffect(() => {
    let intervalId: number | undefined

    if (connected) {
      // Initial frame send only if not dragging
      if (!isDragging) {
        sendControlFrame()
      }
      
      // Set up interval for periodic frame sending
      intervalId = window.setInterval(() => {
        // Only send updates if we're not dragging OR if there's a pending update
        if (!isDragging || pendingUpdate) {
          sendControlFrame()
          if (pendingUpdate) {
            setPendingUpdate(false)
          }
        }
      }, 2000)
    }

    return () => {
      if (intervalId !== undefined) {
        clearInterval(intervalId)
      }
    }
  }, [connected, sendControlFrame, isDragging, pendingUpdate])

  // Handle slider drag start
  const handleSliderDragStart = () => {
    setIsDragging(true)
    // Clear any pending timeouts
    if (sliderTimeoutRef.current !== null) {
      clearTimeout(sliderTimeoutRef.current)
    }
  }

  // Handle slider value change
  const handleSliderChange = (setter: React.Dispatch<React.SetStateAction<number>>, value: number) => {
    setter(value)
    
    // Don't send requests during dragging
    if (!isDragging) {
      // For keyboard navigation or programmatic changes, debounce the request
      if (sliderTimeoutRef.current !== null) {
        clearTimeout(sliderTimeoutRef.current)
      }
      
      sliderTimeoutRef.current = window.setTimeout(() => {
        setPendingUpdate(true)
        sendControlFrame()
        sliderTimeoutRef.current = null
      }, 300)
    }
  }

  // Handle slider drag end
  const handleSliderDragEnd = () => {
    if (isDragging) {
      setIsDragging(false)
      setPendingUpdate(true)
      // Immediately send the frame after slider release
      sendControlFrame()
    }
  }

  const toggleLed1 = () => {
    setLed1(prev => !prev)
  }

  const toggleLed2 = () => {
    setLed2(prev => !prev)
  }

  return (
    <div className="app-container">
      <h1>Robot Controller</h1>
      <div className="ip-input">
        <label>Robot IP: </label>
        <input 
          type="text" 
          value={robotIp} 
          onChange={(e) => setRobotIp(e.target.value)} 
        />
        <button onClick={handleConnect}>Connect Robot</button>
      </div>

      {connectionError && connected && (
        <div className="error-banner">
          Connection issues with the robot. Retrying...
        </div>
      )}

      <div className="controls" style={{ display: connected ? 'block' : 'none' }}>
        <div className="control-pad">
          <button className="control-btn up" onClick={handleMoveForward}>↑</button>
          <button className="control-btn left" onClick={handleMoveLeft}>←</button>
          <button className="control-btn center" onClick={handleStop}>●</button>
          <button className="control-btn right" onClick={handleMoveRight}>→</button>
          <button className="control-btn down" onClick={handleMoveBackward}>↓</button>
        </div>

        <div className="engine-control">
          <label>Left Engine: {leftEngine}</label>
          <input 
            type="range" 
            min="-128" 
            max="127" 
            value={leftEngine}
            onChange={(e) => handleSliderChange(setLeftEngine, Number(e.target.value))}
            onMouseDown={handleSliderDragStart}
            onTouchStart={handleSliderDragStart}
            onKeyDown={() => setIsDragging(true)} // For keyboard navigation
            onKeyUp={handleSliderDragEnd}
          />
        </div>

        <div className="led-controls">
          <button 
            className='card' 
            style={{ backgroundColor: led1 ? '#4CAF50' : '#f44336' }} 
            onClick={toggleLed1}
          >
            LED 1 {led1 ? 'ON' : 'OFF'}
          </button>
          <button 
            className='card' 
            style={{ backgroundColor: led2 ? '#4CAF50' : '#f44336' }} 
            onClick={toggleLed2}
          >
            LED 2 {led2 ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="engine-control">
          <label>Right Engine: {rightEngine}</label>
          <input 
            type="range" 
            min="-128" 
            max="127" 
            value={rightEngine} 
            onChange={(e) => handleSliderChange(setRightEngine, Number(e.target.value))}
            onMouseDown={handleSliderDragStart}
            onTouchStart={handleSliderDragStart}
            onKeyDown={() => setIsDragging(true)} // For keyboard navigation
            onKeyUp={handleSliderDragEnd}
          />
        </div>

        <div className="sensor-data">
          <h3>Robot Data</h3>
          <p>Battery: {batteryVoltage} mV</p>
          <div className="sensor-values">
            {sensorValues.map((value, index) => (
              <p key={index}>Sensor {index + 1}: {value}</p>
            ))}
          </div>
        </div>
      </div>

      <div className="status">
        <p>{connected ? `Connected to robot at ${robotIp}` : "Not Connected"}</p>
        <p>Response: {responseMessage}</p>
      </div>

      <ToastContainer 
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  )
}

export default App
