import React, { useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import './NxJsonEditor.css';

interface NxJsonEditorProps {
  nxJson: any;
  onUpdate: (updatedNxJson: any) => void;
}

const NxJsonEditor: React.FC<NxJsonEditorProps> = ({ nxJson, onUpdate }) => {
  const [editorValue, setEditorValue] = useState(
    JSON.stringify(nxJson, null, 2)
  );
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value) {
      setEditorValue(value);
      setError(null);
    }
  }, []);

  const handleApplyChanges = useCallback(async () => {
    try {
      setIsUpdating(true);
      setError(null);
      const parsed = JSON.parse(editorValue);
      await onUpdate(parsed);
    } catch (e) {
      setError('Invalid JSON: ' + (e as Error).message);
    } finally {
      setIsUpdating(false);
    }
  }, [editorValue, onUpdate]);

  return (
    <div className="nx-json-editor">
      <div className="editor-controls">
        <button
          onClick={handleApplyChanges}
          className="apply-button"
          disabled={isUpdating}
        >
          {isUpdating ? 'Updating Graph...' : 'Apply Changes'}
        </button>
        {error && <span className="error-message">{error}</span>}
        {isUpdating && (
          <span className="updating-message">
            Regenerating project graph...
          </span>
        )}
      </div>

      <Editor
        height="600px"
        defaultLanguage="json"
        value={editorValue}
        onChange={handleEditorChange}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          formatOnPaste: true,
          formatOnType: true,
          automaticLayout: true,
        }}
      />

      <div className="editor-hints">
        <h4>Quick Examples:</h4>
        <ul>
          <li>Add a new target default: Add an entry to "targetDefaults"</li>
          <li>
            Modify build dependencies: Update "targetDefaults.build.dependsOn"
          </li>
          <li>Change cache settings: Update "targetDefaults.[target].cache"</li>
          <li>Add inputs: Modify "targetDefaults.[target].inputs"</li>
        </ul>
      </div>
    </div>
  );
};

export default NxJsonEditor;
