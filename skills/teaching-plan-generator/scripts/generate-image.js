#!/usr/bin/env node
/**
 * 教案图片生成器 - SVG + Sharp → PNG
 * 
 * 用法:
 *   node generate-image.js <json_data_file>
 *   node generate-image.js --demo
 * 
 * JSON 数据格式见 generate-image.js 中的 exampleData
 * 依赖: sharp (npm install sharp)
 */

const sharp = require(require('path').join(__dirname, '..', 'node_modules', 'sharp'));
const fs = require('fs');
const path = require('path');

// ========== 间距配置 ==========
const SPACING = {
  pagePaddingX: 55,        // 页面左右内边距
  pagePaddingTop: 50,      // 页面顶部内边距
  sectionGap: 48,          // 板块间距 (h2 之间)
  subsectionGap: 30,       // 子板块间距 (h3 之间)
  listItemGap: 18,         // 列表项间距
  tableCellPadX: 14,       // 表格单元格水平内边距
  tableCellPadY: 12,       // 表格单元格垂直内边距
  tableRowMinHeight: 40,   // 表格行最小高度
  lineGap: 6,              // 同一段落内行间距
  paragraphGap: 16,        // 段落间距
};

// ========== 字体配置 ==========
const FONTS = {
  main: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", "WenQuanYi Micro Hei", sans-serif',
  mono: '"Courier New", "Noto Sans Mono CJK SC", monospace',
};

// ========== 颜色配置 ==========
const COLORS = {
  title: '#1a1a1a',
  heading: '#1a1a1a',
  body: '#333333',
  bold: '#1a1a1a',
  border: '#cccccc',
  headerBg: '#f0f0f0',
  labelBg: '#f5f5f5',
  cellBg: '#fafafa',
  boardBg: '#f9f9f9',
  boardBorder: '#dddddd',
  divider: '#e0e0e0',
};

/**
 * 生成教案 SVG
 * @param {Object} data - 教案数据
 * @returns {string} SVG 字符串
 */
function generateSVG(data) {
  const W = 800;
  let y = SPACING.pagePaddingTop;
  const elements = [];

  // 辅助函数：添加文字
  function addText(x, yPos, text, className, anchor = 'start') {
    elements.push(`<text x="${x}" y="${yPos}" text-anchor="${anchor}" class="${className}">${escapeXml(text)}</text>`);
  }

  // 辅助函数：添加分割线
  function addDivider(yPos) {
    elements.push(`<line x1="${SPACING.pagePaddingX}" y1="${yPos}" x2="${W - SPACING.pagePaddingX}" y2="${yPos}" stroke="${COLORS.divider}" stroke-width="2"/>`);
  }

  // 辅助函数：计算多行文字高度
  function textLines(text, maxWidth, fontSize) {
    const avgCharWidth = fontSize * 0.55;
    const charsPerLine = Math.floor(maxWidth / avgCharWidth);
    return Math.ceil(text.length / charsPerLine);
  }

  // ========== 标题 ==========
  addText(W / 2, y + 28, data.title, 'title', 'middle');
  y += 55;

  // ========== 信息表格 ==========
  if (data.infoTable && data.infoTable.length > 0) {
    const col1W = 150;
    const col2W = W - SPACING.pagePaddingX * 2 - col1W;
    const rowH = 34;
    
    data.infoTable.forEach((row, i) => {
      const ry = y + i * rowH;
      elements.push(`<rect x="${SPACING.pagePaddingX}" y="${ry}" width="${col1W}" height="${rowH}" fill="${COLORS.labelBg}" stroke="${COLORS.border}" stroke-width="1.5"/>`);
      elements.push(`<rect x="${SPACING.pagePaddingX + col1W}" y="${ry}" width="${col2W}" height="${rowH}" fill="white" stroke="${COLORS.border}" stroke-width="1.5"/>`);
      addText(SPACING.pagePaddingX + col1W / 2, ry + 22, row[0], 'body-bold', 'middle');
      addText(SPACING.pagePaddingX + col1W + 15, ry + 22, row[1], 'body');
    });
    y += data.infoTable.length * rowH + SPACING.sectionGap;
  }

  // ========== 各板块 ==========
  data.sections.forEach((section, sIdx) => {
    // 板块标题 (h2)
    addText(SPACING.pagePaddingX, y + 20, section.title, 'h2');
    y += 28;
    addDivider(y);
    y += SPACING.sectionGap - 20;

    if (section.type === 'list') {
      // 列表型内容（教学目标、教学反思等）
      section.items.forEach((item, i) => {
        if (item.label) {
          addText(SPACING.pagePaddingX + 20, y + 14, `${i + 1}. ${item.label}`, 'body-bold');
          y += SPACING.lineGap + 14;
          // 支持多行内容
          const lines = wrapText(item.text, W - SPACING.pagePaddingX * 2 - 40, 14);
          lines.forEach(line => {
            addText(SPACING.pagePaddingX + 40, y + 14, line, 'body');
            y += SPACING.lineGap + 14;
          });
        } else {
          const lines = wrapText(`${i + 1}. ${item.text}`, W - SPACING.pagePaddingX * 2 - 20, 14);
          lines.forEach((line, li) => {
            addText(SPACING.pagePaddingX + 20, y + 14, line, 'body');
            y += SPACING.lineGap + 14;
          });
        }
        y += SPACING.listItemGap;
      });
      y += SPACING.paragraphGap;

    } else if (section.type === 'subsections') {
      // 带子标题的内容（教学分析等）
      const subTitleX = SPACING.pagePaddingX + 20;
      const subItemX = SPACING.pagePaddingX + 40;
      const subItemW = W - subItemX - SPACING.pagePaddingX;

      section.subsections.forEach(sub => {
        // 子标题：加粗显示
        addText(subTitleX, y + 16, sub.title, 'h3');
        y += 30;

        sub.items.forEach((item, i) => {
          if (item.label) {
            // 有标签：标签（加粗）+ 内容（正常）
            addText(subItemX, y + 14, item.label, 'body-bold');
            y += SPACING.lineGap + 14;
            const lines = wrapText(item.text, subItemW - 10, 14);
            lines.forEach(line => {
              addText(subItemX + 10, y + 14, line, 'body');
              y += SPACING.lineGap + 14;
            });
          } else {
            // 无标签：编号 + 内容
            const fullText = `${i + 1}. ${item.text}`;
            const lines = wrapText(fullText, subItemW, 14);
            lines.forEach((line, li) => {
              const xOff = li === 0 ? subItemX : subItemX + 10;
              addText(xOff, y + 14, line, 'body');
              y += SPACING.lineGap + 14;
            });
          }
          y += 8;
        });
        y += SPACING.paragraphGap - 8;
      });

    } else if (section.type === 'table') {
      // 四栏表格（教学过程）
      const colWidths = section.colWidths || [120, 260, 170, 150];
      const totalW = colWidths.reduce((a, b) => a + b, 0);
      const startX = SPACING.pagePaddingX;

      // 表头
      elements.push(`<rect x="${startX}" y="${y}" width="${totalW}" height="35" fill="${COLORS.headerBg}" stroke="${COLORS.border}" stroke-width="1.5"/>`);
      let colX = startX;
      section.headers.forEach((h, ci) => {
        if (ci > 0) {
          elements.push(`<line x1="${colX}" y1="${y}" x2="${colX}" y2="${y + 35}" stroke="${COLORS.border}" stroke-width="1.5"/>`);
        }
        addText(colX + colWidths[ci] / 2, y + 22, h, 'table-header', 'middle');
        colX += colWidths[ci];
      });
      y += 35;

      // 表格行
      section.rows.forEach(row => {
        // 计算行高：取所有单元格中最大行数
        const cellFontSize = 13;
        const cellLineH = cellFontSize + SPACING.lineGap; // 每行高度
        const cellLines = row.cells.map((cell, ci) => {
          const maxW = colWidths[ci] - SPACING.tableCellPadX * 2;
          return wrapText(cell.text || '', maxW, cellFontSize).length;
        });
        const maxLines = Math.max(...cellLines);
        const rowH = Math.max(SPACING.tableRowMinHeight, maxLines * cellLineH + SPACING.tableCellPadY * 2);

        // 绘制单元格背景和边框
        colX = startX;
        row.cells.forEach((cell, ci) => {
          const bg = ci === 0 ? COLORS.cellBg : 'white';
          elements.push(`<rect x="${colX}" y="${y}" width="${colWidths[ci]}" height="${rowH}" fill="${bg}" stroke="${COLORS.border}" stroke-width="1.5"/>`);
          
          // 单元格内容
          const lines = wrapText(cell.text || '', colWidths[ci] - SPACING.tableCellPadX * 2, cellFontSize);
          // 垂直居中：计算起始Y坐标
          const contentH = lines.length * cellLineH;
          const cellStartY = y + (rowH - contentH) / 2 + cellFontSize; // 底线位置
          lines.forEach((line, li) => {
            const cls = cell.bold ? 'body-bold' : 'small';
            addText(colX + SPACING.tableCellPadX, cellStartY + li * cellLineH, line, cls);
          });

          colX += colWidths[ci];
        });
        y += rowH;
      });
      y += SPACING.paragraphGap;

    } else if (section.type === 'board') {
      // 板书设计（特殊样式，高度自适应）
      const boardLines = section.content.split('\n');
      const boardLineH = 24;
      const boardPadTop = 30;
      const boardPadBottom = 20;
      const boardH = boardPadTop + boardLines.length * boardLineH + boardPadBottom;
      elements.push(`<rect x="${SPACING.pagePaddingX}" y="${y}" width="${W - SPACING.pagePaddingX * 2}" height="${boardH}" fill="${COLORS.boardBg}" stroke="${COLORS.boardBorder}" stroke-width="1.5" rx="6"/>`);
      
      const boardStartY = y + boardPadTop;
      boardLines.forEach((line, i) => {
        addText(W / 2, boardStartY + i * boardLineH + 14, line.trim(), 'board', 'middle');
      });
      y += boardH + SPACING.paragraphGap;

    } else if (section.type === 'text') {
      // 普通段落文本
      const lines = wrapText(section.content, W - SPACING.pagePaddingX * 2 - 20, 14);
      lines.forEach(line => {
        addText(SPACING.pagePaddingX + 20, y + 14, line, 'body');
        y += SPACING.lineGap + 14;
      });
      y += SPACING.paragraphGap;
    }
  });

  // 计算总高度
  const totalH = y + 50;

  // ========== 组装 SVG ==========
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${totalH}" viewBox="0 0 ${W} ${totalH}">
  <defs>
    <style>
      text { font-family: ${FONTS.main}; }
      .title { font-size: 28px; font-weight: bold; fill: ${COLORS.title}; }
      .h2 { font-size: 20px; font-weight: bold; fill: ${COLORS.heading}; }
      .h3 { font-size: 16px; font-weight: bold; fill: ${COLORS.body}; }
      .body { font-size: 14px; fill: ${COLORS.body}; }
      .body-bold { font-size: 14px; font-weight: bold; fill: ${COLORS.bold}; }
      .small { font-size: 13px; fill: ${COLORS.body}; }
      .table-header { font-size: 14px; font-weight: bold; fill: ${COLORS.bold}; }
      .board { font-family: ${FONTS.mono}; font-size: 14px; fill: ${COLORS.body}; }
    </style>
  </defs>
  <rect width="${W}" height="${totalH}" fill="white"/>
  ${elements.join('\n  ')}
</svg>`;

  return svg;
}

/**
 * 计算单个字符的显示宽度
 * 中文字符约占字体大小的 1.0 倍，英文/数字约占 0.55 倍
 */
function charWidth(ch, fontSize) {
  const code = ch.charCodeAt(0);
  // 中文字符范围：CJK统一汉字、CJK标点、全角字符
  if (
    (code >= 0x4E00 && code <= 0x9FFF) ||   // CJK统一汉字
    (code >= 0x3000 && code <= 0x303F) ||   // CJK标点符号
    (code >= 0xFF00 && code <= 0xFFEF) ||   // 全角字符
    (code >= 0x2E80 && code <= 0x2EFF) ||   // CJK部首补充
    (code >= 0xF900 && code <= 0xFAFF) ||   // CJK兼容象形文字
    (code >= 0xFE30 && code <= 0xFE4F) ||   // CJK兼容形式
    (code >= 0x2000 && code <= 0x206F)      // 通用标点（部分全角）
  ) {
    return fontSize * 1.0;
  }
  // ASCII 字符
  if (code >= 0x20 && code <= 0x7E) {
    return fontSize * 0.6;
  }
  // 其他字符按全角处理
  return fontSize * 1.0;
}

/**
 * 计算文本字符串的总显示宽度
 */
function textWidth(text, fontSize) {
  let width = 0;
  for (const ch of text) {
    width += charWidth(ch, fontSize);
  }
  return width;
}

/**
 * 文本自动换行（支持中英文混排）
 */
function wrapText(text, maxWidth, fontSize) {
  if (!text) return [''];
  
  // 如果文本宽度没超，直接返回
  if (textWidth(text, fontSize) <= maxWidth) {
    return [text];
  }
  
  const result = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    if (textWidth(remaining, fontSize) <= maxWidth) {
      result.push(remaining);
      break;
    }
    
    // 逐字符查找断点
    let breakAt = 0;
    let currentWidth = 0;
    const punctuation = '，。、；：！？）》」』】,.;:!?)';
    let lastPunctPos = -1;
    
    for (let i = 0; i < remaining.length; i++) {
      const w = charWidth(remaining[i], fontSize);
      currentWidth += w;
      
      // 记录最后一个标点位置
      if (punctuation.includes(remaining[i])) {
        lastPunctPos = i + 1;
      }
      
      if (currentWidth > maxWidth) {
        // 超出宽度了，在此处断行
        if (lastPunctPos > 0 && lastPunctPos > i - 8) {
          // 优先在最近的标点后断行
          breakAt = lastPunctPos;
        } else if (i > 0) {
          // 在当前字符前断行
          breakAt = i;
        } else {
          breakAt = 1;
        }
        break;
      }
    }
    
    if (breakAt === 0) {
      // 没找到断点，全部放入
      breakAt = remaining.length;
    }
    
    result.push(remaining.substring(0, breakAt));
    remaining = remaining.substring(breakAt);
  }
  
  return result.length > 0 ? result : [''];
}

/**
 * XML 特殊字符转义
 */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  
  let data;
  if (args.includes('--demo')) {
    data = getDemoData();
  } else if (args.length > 0 && fs.existsSync(args[0])) {
    data = JSON.parse(fs.readFileSync(args[0], 'utf-8'));
  } else {
    console.error('用法: node generate-image.js <json_data_file>');
    console.error('      node generate-image.js --demo');
    process.exit(1);
  }

  const svg = generateSVG(data);
  const svgBuffer = Buffer.from(svg);
  
  const outputPath = data.outputPath || path.join(
    process.env.TMPDIR || '/tmp',
    `${data.title || '教案'}-图片.png`
  );

  // 确保输出目录存在
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  await sharp(svgBuffer)
    .png({ quality: 100 })
    .toFile(outputPath);

  console.log(`✅ 图片已生成: ${outputPath}`);
  console.log(`   大小: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);
}

/**
 * Demo 数据
 */
function getDemoData() {
  return {
    title: '小学音乐教案',
    outputPath: '/tmp/教案-demo.png',
    infoTable: [
      ['课 题', '示例歌曲'],
      ['课 时', '1课时（40分钟）'],
      ['课 型', '唱歌课'],
      ['备课时间', '2026年6月9日'],
    ],
    sections: [
      {
        title: '一、教学目标',
        type: 'list',
        items: [
          { label: '感受与体验', text: '感受歌曲欢快、活泼的情绪，体会美好意境。' },
          { label: '能力与方法', text: '能用自然、轻快的声音有感情地演唱歌曲。' },
          { label: '拓展与认知', text: '了解二声部合唱的基本概念。' },
        ],
      },
      {
        title: '二、教学分析',
        type: 'subsections',
        subsections: [
          {
            title: '教学重点',
            items: [
              { text: '用欢快、轻盈的声音有感情地演唱歌曲。' },
            ],
          },
          {
            title: '教学难点',
            items: [
              { text: '歌曲中连续重复乐句的节奏紧凑，对二年级学生有一定难度。' },
            ],
          },
        ],
      },
      {
        title: '三、教学过程',
        type: 'table',
        headers: ['教学步骤', '教师活动', '学生活动', '设计意图'],
        colWidths: [120, 260, 170, 150],
        rows: [
          {
            cells: [
              { text: '一、情境导入（约5分钟）', bold: true },
              { text: '① 播放视频，提问：同学们，你们看屏幕上是什么季节？' },
              { text: '① 观看视频，积极回答问题。' },
              { text: '快速创设情境，激发学习兴趣。' },
            ],
          },
          {
            cells: [
              { text: '二、整体感知（约7分钟）', bold: true },
              { text: '① 完整播放歌曲录音，要求学生安静聆听。' },
              { text: '① 安静聆听，感受歌曲情绪。' },
              { text: '建立歌曲整体印象。' },
            ],
          },
        ],
      },
      {
        title: '四、板书设计',
        type: 'board',
        content: `示例歌曲（唱歌课 · 二年级上册）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
情绪：欢快、活泼    速度：稍快地
拍号：2/4          调号：1 = F
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
★ 核心：轻快演唱 + 力度变化`,
      },
      {
        title: '五、课堂小结',
        type: 'text',
        content: '今天我们学习了歌曲，用轻快、活泼的声音演唱了这首歌曲。希望大家能记住这首欢快的歌！',
      },
      {
        title: '六、教学反思',
        type: 'list',
        items: [
          { text: '部分学生节奏掌握不够准确，教学中应适当放慢速度。' },
          { text: '二声部合唱体验环节，学生初次接触，可适当简化要求。' },
        ],
      },
    ],
  };
}

main().catch(err => {
  console.error('❌ 生成失败:', err.message);
  process.exit(1);
});
