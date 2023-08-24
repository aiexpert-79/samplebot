import React from 'react';
import { getReasonPhrase } from 'http-status-codes';
import { Alert, Badge, Button, Card, Form, Spinner } from 'react-bootstrap';
import { DivProps } from 'react-html-props';
import { OpenAIExt } from '../OpenAIExt';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.css';

export interface ClientDemoProps extends DivProps {}

export const ClientDemo = (props: ClientDemoProps) => {
  const [model, setModel] = React.useState('gpt-3.5-turbo');
  const [apiKey, setApiKey] = React.useState('');
  const [systemPrompt, setSystemPrompt] = React.useState('You are a helpful medical assistant. Please answer only medical questions.');
  const [userPrompt, setUserPrompt] = React.useState('Hi');
  const [error, setError] = React.useState<undefined | Error>(undefined);
  const [status, setStatus] = React.useState<undefined | number>(undefined);
  const [completion, setCompletion] = React.useState('');
  const [xhr, setXhr] = React.useState<XMLHttpRequest | undefined>(undefined);
  const [showKey, setShowKey] = React.useState(false);
  const [record, setRecord] = React.useState(false);
  const [shouldRun, setShouldRun] = React.useState(false);
  const [running, setRunning] = React.useState(false);

  const handleStartRecording = () => {
    setRecord(true);
    let chunks = [];
    let mediaRecorder;
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
          mediaRecorder = new MediaRecorder(stream);
          mediaRecorder.addEventListener('dataavailable', event => chunks.push(event.data));
          mediaRecorder.start();
      })
      .catch(error => console.error(error));
  };
  
  const handleStopRecording = async (blob:any) => {
    setRecord(false);
    let chunks;
    blob = new Blob(chunks, { type: 'audio/mpeg' });
    const formData = new FormData();
    formData.append('audio', blob, 'recording.wav');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    formData.append('auto_highlights', 'true');
    formData.append('speaker_labels', 'true');
    console.log(formData);

    try {
      const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: 'Bearer ' + apiKey,
          },
        }
      );
      console.log(response);  
      if (response.data?.transcripts?.length > 0) {
        const { question } = response.data.transcripts[0];
        setUserPrompt(question);
      }
    } catch (error) {
      console.error(error);
    }
  };
  
  React.useEffect(() => {
    if (shouldRun && !running) {
      setShouldRun(false);
      setRunning(true);
      setError(undefined);
      setStatus(undefined);
      setCompletion('');

      const xhr = OpenAIExt.streamClientChatCompletion(
        {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        },
        {
          apiKey,
          handler: {
            onContent(contentDraft, isFinal, xhr) {
              setCompletion(contentDraft);
            },
            onDone(xhr) {
              setRunning(false);
              setXhr(undefined);
            },
            onError(error, status, xhr) {
              console.error(error);
              setError(error);
              setStatus(status);
              setXhr(undefined);
              setRunning(false);
            },
          },
        },
      );
      setXhr(xhr);
    }
  }, [apiKey, model, running, shouldRun, systemPrompt, userPrompt]);

  return (
    <Card>
      <Card.Body>
        <Form
          className="d-flex flex-column gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!running) {
              setShouldRun(true);
            }
          }}
        >
          <Card>
            <Card.Body className="d-flex flex-column gap-1">
              <div>
                <div className="small fw-bold">API Key:</div>
                <div className="d-flex gap-1">
                  <Form.Control
                    type={showKey ? 'text' : 'password'}
                    placeholder="Enter API key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    required
                  />
                  <Button variant="outline-primary" onClick={() => setShowKey(!showKey)}>
                    {showKey ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </div>
            </Card.Body>
          </Card>
          <Alert variant="info" className="d-flex flex-column gap-1 mb-0">
            <div className="small fw-bold">🤖 System Prompt:</div>
            <Form.Control
              type="text"
              placeholder="Enter system prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              required
            />
          </Alert>
          <Alert variant="primary" className="d-flex flex-column gap-1 mb-0">
            <div className="small fw-bold">👩‍🦰 User Prompt:</div>
            <div className='d-flex gap-1'>
              <Form.Control
                type="text"
                name='question'
                placeholder="Enter user prompt"
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                required
              />
              <Button variant="outline-primary" onClick={record ? handleStopRecording : handleStartRecording}>
                {record ? 'Stop' : 'Record'}
              </Button>
            </div>
          </Alert>
          <div className="d-flex gap-1">
            <Button type="submit" variant="primary" disabled={running}>
              <div className="d-flex align-items-center gap-2">
                {running && <Spinner animation="border" role="status" size="sm" />}
                Send
              </div>
            </Button>
            <Button type="submit" variant="secondary" disabled={!running} onClick={() => xhr?.abort()}>
              Stop
            </Button>
          </div>
          {completion && (
            <Alert variant="success" className="d-flex flex-column gap-1 mb-0">
              <pre className="fw-bold mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                {completion}
                {running && <>█</>}
              </pre>
            </Alert>
          )}
          {error && (
            <Alert variant="danger" className="d-flex flex-column gap-1 mb-0">
              {status && (
                <div>
                  <Badge bg="danger">
                    {status} {getReasonPhrase(status)}
                  </Badge>
                </div>
              )}
              <div className="fw-bold">{`${error}`}</div>
            </Alert>
          )}
        </Form>
      </Card.Body>
    </Card>
  );
};
