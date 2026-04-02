import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function parsePdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // テキストアイテムを位置情報を考慮して結合
    let lastY: number | null = null;
    let lineText = '';
    const lines: string[] = [];

    for (const item of content.items as any[]) {
      if (!item.str) continue;

      const y = Math.round(item.transform[5]);

      if (lastY !== null && Math.abs(y - lastY) > 5) {
        // 新しい行
        if (lineText.trim()) lines.push(lineText.trim());
        lineText = item.str;
      } else {
        // 同じ行の続き（スペースが必要な場合のみ追加）
        if (lineText && !lineText.endsWith(' ') && !item.str.startsWith(' ')) {
          // 日本語の場合はスペース不要
          const lastChar = lineText[lineText.length - 1];
          const firstChar = item.str[0];
          const isJapanese = /[\u3000-\u9fff\uf900-\ufaff]/.test(lastChar) || /[\u3000-\u9fff\uf900-\ufaff]/.test(firstChar);
          lineText += isJapanese ? item.str : ' ' + item.str;
        } else {
          lineText += item.str;
        }
      }
      lastY = y;
    }
    if (lineText.trim()) lines.push(lineText.trim());

    pages.push(lines.join('\n'));
  }

  return pages.join('\n\n');
}
