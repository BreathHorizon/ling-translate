import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Github } from 'lucide-react';
import manifest from '../../manifest.json';

export const About: React.FC = () => {
  const version = manifest.version;
  const build = 30;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">About Ling Translate</h2>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Ling Translate v{version}</span>
            <span className="text-sm font-normal text-gray-400">Build {build}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-gray-600">
            Ling Translate is a powerful Chrome extension for web translation with customizable AI models.
            It allows you to translate web pages using your own API keys and preferred AI models.
          </p>

          <div className="flex flex-col gap-4">
            <a 
              href="https://github.com/breathhorizon/ling-translate" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-gray-700 hover:text-primary transition-colors p-4 border rounded-lg hover:bg-gray-50"
            >
              <Github className="w-6 h-6" />
              <div>
                <h3 className="font-semibold">GitHub Repository</h3>
                <p className="text-sm text-gray-500">View source code, report issues, and contribute.</p>
              </div>
            </a>
          </div>

          <div className="pt-6 border-t">
            <h3 className="font-semibold mb-2">Features</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Customizable AI API configuration (OpenAI compatible)</li>
              <li>Multiple model support with custom prompts</li>
              <li>Smart web page translation</li>
              <li>Secure local storage for API keys</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
