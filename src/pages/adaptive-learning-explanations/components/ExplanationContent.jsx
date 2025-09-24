import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const ExplanationContent = ({ concept = {}, onNeedMoreHelp, onGotIt }) => {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'BookOpen' },
    { id: 'detailed', label: 'Detailed', icon: 'Microscope' },
    { id: 'examples', label: 'Examples', icon: 'List' },
    { id: 'formula', label: 'Formula', icon: 'Calculator' }
  ];

  const renderTabContent = () => {
    if (!concept || Object.keys(concept).length === 0) {
      return (
        <div className="text-center text-muted-foreground py-12">
          No content available in the provided document.
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-4">
            <p className="text-foreground leading-relaxed">
              {concept?.overview || 'Overview not available.'}
            </p>
            {concept?.keyPoints?.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium text-foreground mb-2 flex items-center space-x-2">
                  <Icon name="CheckCircle" size={16} className="text-success" />
                  <span>Key Points to Remember</span>
                </h4>
                <ul className="space-y-1 text-sm text-foreground">
                  {concept.keyPoints.map((point, idx) => (
                    <li key={idx} className="flex items-start space-x-2">
                      <Icon name="Dot" size={12} className="text-primary mt-0.5 flex-shrink-0" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );

      case 'detailed':
        return (
          <div className="prose prose-gray max-w-none">
            <div className="text-foreground leading-relaxed whitespace-pre-line">
              {concept?.detailedExplanation || 'Detailed explanation not available.'}
            </div>
          </div>
        );

      case 'examples':
        if (!concept?.examples?.length) {
          return <div className="text-muted-foreground">No examples provided.</div>;
        }
        return (
          <div className="space-y-4">
            {concept.examples.map((example, idx) => (
              <div key={idx} className="bg-card border rounded-lg p-4">
                <h4 className="font-medium text-foreground mb-1">{example?.title}</h4>
                <p className="text-sm text-muted-foreground">{example?.description}</p>
              </div>
            ))}
          </div>
        );

      case 'formula':
        return concept?.formula ? (
          <div className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-6 text-center">
              <h4 className="font-medium text-foreground mb-4">Chemical Equation</h4>
              <div className="text-lg font-data text-primary bg-background rounded-lg p-4 border">
                {concept.formula}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground">No formula provided.</div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6 bg-muted p-1 rounded-lg overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={tab.icon} size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="mb-8">{renderTabContent()}</div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onNeedMoreHelp}
            className="flex items-center justify-center space-x-2 px-6 py-3 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors duration-200"
          >
            <Icon name="HelpCircle" size={16} />
            <span className="font-medium">Need More Help</span>
          </button>

          <button
            onClick={onGotIt}
            className="flex items-center justify-center space-x-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all duration-200 transform hover:scale-105"
          >
            <Icon name="CheckCircle" size={16} />
            <span className="font-medium">Got It!</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExplanationContent;
