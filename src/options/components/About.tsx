import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Github } from 'lucide-react';
import manifest from '../../manifest.json';

export const About: React.FC = () => {
  const version = manifest.version;
  const build = 41;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">关于 Ling Translate</h2>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Ling Translate v{version}</span>
            <span className="text-sm font-normal text-gray-400">构建 {build}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-gray-600">
            Ling Translate 是一款强大的网页翻译 Chrome 扩展，支持自定义 AI 模型。
            你可以使用自己的 API 密钥和偏好的 AI 模型来翻译网页。
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
                <h3 className="font-semibold">GitHub 仓库</h3>
                <p className="text-sm text-gray-500">查看源码、报告问题并参与贡献。</p>
              </div>
            </a>
          </div>

          <div className="pt-6 border-t">
            <h3 className="font-semibold mb-2">功能</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>可自定义 AI API 配置（兼容 OpenAI）</li>
              <li>支持多模型与自定义提示词</li>
              <li>智能网页翻译</li>
              <li>API 密钥安全地存储在本地</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
