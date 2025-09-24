import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Button from '../../components/ui/Button';
import AppIcon from '../../components/AppIcon';
import fileAnalysisService from '../../services/fileAnalysisService';
import conceptExtractionService from '../../services/conceptExtractionService';

const FileUpload = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [error, setError] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);

  // -------------------------
  // Drag & Drop Handlers
  // -------------------------
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
      console.log('Drag active');
    } else if (e.type === 'dragleave') {
      setDragActive(false);
      console.log('Drag left');
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      console.log('File dropped:', e.dataTransfer.files[0]);
      handleFileSelection(e.dataTransfer.files[0], true);
    }
  }, []);

  // -------------------------
  // File Input Handlers
  // -------------------------
  const handleFileInputChange = (e) => {
    console.log('handleFileInputChange fired', e.target.files);
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0], true);
    }
  };

  const handleFileSelection = (file, autoProcess = false) => {
    console.log('handleFileSelection called with file:', file);

    const validation = fileAnalysisService.validateFile(file);
    console.log('Validation result:', validation);

    if (!validation?.isValid) {
      setError(validation?.error);
      console.warn('File validation failed:', validation.error);
      return;
    }

    setSelectedFile(file);
    setError('');
    console.log('File selected and state updated:', file.name);

    if (autoProcess) {
      handleFileUpload(file);
    }
  };

  // -------------------------
  // File Processing
  // -------------------------
  const handleFileUpload = async (fileParam = null) => {
    const fileToProcess = fileParam || selectedFile;
    if (!fileToProcess) {
      console.warn('No file selected for processing');
      return;
    }

    setIsProcessing(true);
    setError('');
    console.log('Processing started for file:', fileToProcess.name);

    try {
      // Step 1: Analyze file
      setProcessingStep('Analyzing file content...');
      console.log('Step 1: Analyzing file content...');
      const analysis = await fileAnalysisService.analyzeFile(fileToProcess);
      console.log('Analysis result:', analysis);

      // Step 2: Extract concepts
      setProcessingStep('Extracting learning concepts...');
      console.log('Step 2: Extracting concepts...');
      const concepts = conceptExtractionService.extractConcepts(analysis);
      console.log('Extracted concepts:', concepts);

      // Step 3: Create learning pathway
      setProcessingStep('Creating personalized learning pathway...');
      console.log('Step 3: Creating learning pathway...');
      const learningPathway = conceptExtractionService.createLearningPathway(concepts);
      console.log('Learning pathway:', learningPathway);

      setAnalysisResult({ ...analysis, concepts, learningPathway });

      // Store data in sessionStorage
      sessionStorage.setItem(
        'adaptiveLearningData',
        JSON.stringify({ analysis, concepts, learningPathway })
      );

      setProcessingStep('Complete! Redirecting...');
      console.log('Processing complete! Redirecting to assessment...');

      setTimeout(() => {
        navigate('/question-generation-assessment', {
          state: { analysis, concepts, learningPathway }
        });
      }, 1500);

    } catch (err) {
      console.error('Error during file processing:', err);
      setError('Failed to process file. Check console for details.');
      setProcessingStep('');
    } finally {
      setIsProcessing(false);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setError('');
    setAnalysisResult(null);
    console.log('Selected file removed');
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // -------------------------
  // Render
  // -------------------------
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-heading font-bold text-foreground mb-4">
            Upload Your Learning Material
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Upload your documents and our system will analyze the content and generate structured concepts and a personalized learning pathway.
          </p>
        </div>

        {/* File Upload Area */}
        <div className="bg-card rounded-lg border-2 border-dashed border-border p-8 mb-6">
          {!selectedFile ? (
            <div
              className={`text-center transition-all duration-200 ${dragActive ? 'border-primary bg-primary/5' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="mb-6">
                <AppIcon name="Upload" size={48} className="mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-heading font-semibold text-foreground mb-2">
                  Drop your files here
                </h3>
                <p className="text-muted-foreground mb-4">or click to browse from your computer</p>
              </div>

              <Button size="lg" onClick={() => fileInputRef.current?.click()} className="mx-auto">
                <AppIcon name="FolderOpen" size={20} className="mr-2" />
                Choose File
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                accept=".txt,.md,.json,.csv,.pdf"
                onChange={handleFileInputChange}
              />

              <div className="mt-6 text-xs text-muted-foreground">
                Supported formats: TXT, PDF, JSON, CSV, Markdown (Max 10MB)
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected File Info */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center space-x-3">
                  <AppIcon name="File" size={24} className="text-primary" />
                  <div>
                    <p className="font-medium text-foreground">{selectedFile?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(selectedFile?.size)} • {selectedFile?.type || 'Unknown type'}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={removeSelectedFile} disabled={isProcessing}>
                  <AppIcon name="X" size={16} />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Processing Status */}
        {isProcessing && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-6 mb-6">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
              <div>
                <h4 className="font-medium text-foreground">Processing Your File</h4>
                <p className="text-sm text-muted-foreground">{processingStep}</p>
              </div>
            </div>
            <div className="mt-4 bg-background rounded-full h-2">
              <div
                className="h-2 bg-primary rounded-full transition-all duration-500"
                style={{
                  width: processingStep?.includes('Analyzing') ? '50%' :
                         processingStep?.includes('Extracting') ? '90%' : '100%'
                }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <AppIcon name="AlertCircle" size={20} className="text-destructive" />
              <p className="text-destructive font-medium">Error</p>
            </div>
            <p className="text-sm text-destructive/80 mt-1">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload;
