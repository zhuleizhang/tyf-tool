import { TextFilterRule } from '../types/config';

/**
 * 文字过滤器类
 */
export class TextFilter {
  private rules: TextFilterRule[];
  private compiledRegexCache: Map<string, RegExp> = new Map();

  constructor(rules: TextFilterRule[]) {
    this.rules = rules;
    this.compileRegexRules();
  }

  /**
   * 编译正则表达式规则并缓存
   */
  private compileRegexRules(): void {
    this.compiledRegexCache.clear();
    
    this.rules.forEach(rule => {
      if (rule.enabled && rule.pattern) {
        try {
          const regex = new RegExp(rule.pattern, 'g');
          this.compiledRegexCache.set(rule.id, regex);
        } catch (error) {
          console.warn(`规则 "${rule.name}" 的正则表达式编译失败:`, error);
        }
      }
    });
  }

  /**
   * 应用过滤规则到文本
   */
  applyFilter(text: string): string {
    if (!text || this.compiledRegexCache.size === 0) {
      return text;
    }

    let filteredText = text;

    // 按规则顺序应用过滤
    this.rules.forEach(rule => {
      if (rule.enabled) {
        const regex = this.compiledRegexCache.get(rule.id);
        if (regex) {
          // 重置正则表达式的lastIndex，确保每次都从头开始匹配
          regex.lastIndex = 0;
          filteredText = filteredText.replace(regex, '');
        }
      }
    });

    return filteredText;
  }

  /**
   * 测试单个规则对文本的过滤效果
   */
  testRule(ruleId: string, text: string): { 
    matches: string[], 
    filteredText: string,
    matchCount: number 
  } {
    const rule = this.rules.find(r => r.id === ruleId);
    if (!rule || !rule.pattern) {
      return { matches: [], filteredText: text, matchCount: 0 };
    }

    try {
      const regex = new RegExp(rule.pattern, 'g');
      const matches = text.match(regex) || [];
      const filteredText = text.replace(regex, '');
      
      return {
        matches,
        filteredText,
        matchCount: matches.length
      };
    } catch (error) {
      console.warn(`测试规则 "${rule.name}" 失败:`, error);
      return { matches: [], filteredText: text, matchCount: 0 };
    }
  }

  /**
   * 测试所有启用规则对文本的过滤效果
   */
  testAllRules(text: string): {
    originalText: string,
    filteredText: string,
    ruleResults: Array<{
      ruleId: string,
      ruleName: string,
      matches: string[],
      matchCount: number
    }>
  } {
    const ruleResults: Array<{
      ruleId: string,
      ruleName: string,
      matches: string[],
      matchCount: number
    }> = [];

    let currentText = text;

    // 按顺序应用每个启用的规则
    this.rules.forEach(rule => {
      if (rule.enabled) {
        const testResult = this.testRule(rule.id, currentText);
        ruleResults.push({
          ruleId: rule.id,
          ruleName: rule.name,
          matches: testResult.matches,
          matchCount: testResult.matchCount
        });
        currentText = testResult.filteredText;
      }
    });

    return {
      originalText: text,
      filteredText: currentText,
      ruleResults
    };
  }

  /**
   * 更新规则
   */
  updateRules(newRules: TextFilterRule[]): void {
    this.rules = newRules;
    this.compileRegexRules();
  }

  /**
   * 获取当前规则
   */
  getRules(): TextFilterRule[] {
    return [...this.rules];
  }

  /**
   * 获取启用的规则数量
   */
  getEnabledRulesCount(): number {
    return this.rules.filter(rule => rule.enabled).length;
  }
}

/**
 * 创建文字过滤器实例
 */
export function createTextFilter(rules: TextFilterRule[]): TextFilter {
  return new TextFilter(rules);
}

/**
 * 验证正则表达式语法
 */
export function validateRegexPattern(pattern: string): { isValid: boolean, error?: string } {
  try {
    new RegExp(pattern);
    return { isValid: true };
  } catch (error) {
    return { 
      isValid: false, 
      error: (error as Error)?.message || '未知错误' 
    };
  }
}

/**
 * 生成唯一ID
 */
export function generateRuleId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}