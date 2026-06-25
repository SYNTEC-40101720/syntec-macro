// keywords.js
// 关键字、常量、控制流、变量格式定义

exports.keywords = {
  conditional: ['IF', 'THEN', 'ELSE', 'ELSEIF', 'END_IF', 'ENDIF'],
  repeat:      ['REPEAT', 'UNTIL', 'END_REPEAT', 'ENDREPEAT'],
  while:       ['WHILE', 'DO', 'END_WHILE', 'ENDWHILE'],
  for:         ['FOR', 'TO', 'BY', 'END_FOR', 'ENDFOR'],
  case:        ['CASE', 'OF', 'END_CASE', 'ENDCASE'],
  flow:        ['GOTO', 'EXIT', 'PAUSE'],
  operators:   ['AND', 'OR', 'XOR', 'NOT', 'MOD', 'DIV', '&'],
  robot: [
    // 移动指令
    'MOVJ', 'MOVJ-II', 'MOVL', 'MOVC', 'INCMOVJ', 'INCMOVL',
    // 坐标系指令
    'USERCOR', 'OBJCORON', 'OBJCOROFF', 'OBJCORCLEAR',
    'TOOLCOR', 'TOOLCORON', 'TOOLCOROFF',
    // 应用指令
    'SKIPCOND', 'SKIP', 'SWAITSIG', 'SYNCOUT',
    'WEAVEON', 'WEAVEOFF', 'STITCHON', 'STITCHOFF',
    'POSEMAP', 'SHIFTON', 'SHIFTOFF',
    // 速度与轨迹参数
    'ACC', 'DEC', 'FJ', 'FEJ', 'FL', 'FR', 'PL', 'PQ', 'PR'
  ],
  gcodes: [
    'G00','G01','G02','G03','G04','G05','G10','G11','G15','G16','G17','G18','G19',
    'G20','G21','G28','G29','G30','G31','G40','G41','G42','G43','G44','G49',
    'G50','G51','G52','G53','G54','G55','G56','G57','G58','G59','G60','G61',
    'G65','G66','G66.1','G67','G68','G69','G73','G74','G76','G80','G81',
    'G82','G83','G84','G85','G86','G87','G88','G89','G90','G91','G92','G94',
    'G95','G96','G97','G98','G99','G04.1','G08','G09','G22','G23','G25','G26','G27',
    'G34','G35','G36','G37','G37.1','G45','G46','G47','G48',
    'G04.102','G68.18','G192.1','G192.2'
  ],
  mcodes: [
    'M00','M01','M02','M03','M04','M05','M06','M07','M08','M09','M10','M11',
    'M12','M13','M14','M15','M16','M17','M18','M19','M20','M21','M22','M23',
    'M24','M25','M26','M27','M28','M29','M30','M31','M32','M33','M34','M35',
    'M36','M37','M38','M39','M40','M41','M42','M43','M44','M45','M46','M47',
    'M48','M49','M50','M51','M52','M53','M54','M55','M56','M57','M58','M59',
    'M60','M61','M62','M63','M64','M65','M66','M67','M68','M69','M70','M71',
    'M72','M73','M74','M75','M76','M77','M78','M79','M80','M81','M82','M83',
    'M84','M85','M86','M87','M88','M89','M90','M91','M92','M93','M94','M95',
    'M96','M97','M98','M99','M198'
  ]
};

/**
 * 关键词详细说明文档
 * 用于 hover 提示和补全文档
 */
exports.keywordDocs = {
  // 控制流关键词
  'IF': {
    sig: 'IF 条件 THEN',
    doc: '条件判断语句，当条件为真时执行 THEN 后的代码块。可配合 ELSEIF、ELSE 使用。'
  },
  'THEN': {
    sig: 'IF 条件 THEN',
    doc: 'IF 语句的必要组成部分，表示条件为真时开始执行代码块。'
  },
  'ELSE': {
    sig: 'ELSE ... END_IF',
    doc: 'IF 语句的可选分支，当所有 IF/ELSEIF 条件都不满足时执行。'
  },
  'ELSEIF': {
    sig: 'ELSEIF 条件 THEN',
    doc: 'IF 语句的可选分支，用于多条件判断。可连续使用多个 ELSEIF。'
  },
  'END_IF': {
    sig: 'END_IF;',
    doc: '结束 IF 条件语句块。也可写作 ENDIF（无下划线）。'
  },
  'ENDIF': {
    sig: 'ENDIF;',
    doc: '结束 IF 条件语句块（短形式）。等同于 END_IF。'
  },
  'FOR': {
    sig: 'FOR 变量 := 初值 TO 终值 [BY 步进] DO',
    doc: '计数循环语句，变量从初值递增到终值，每次循环执行 DO 后的代码块。BY 指定步进值（默认为1）。'
  },
  'TO': {
    sig: 'FOR 变量 := 初值 TO 终值',
    doc: 'FOR 循环的终止条件，指定循环变量的终值。'
  },
  'BY': {
    sig: 'FOR 变量 := 初值 TO 终值 BY 步进',
    doc: 'FOR 循环的步进值，默认为 1。可为负数实现递减循环。'
  },
  'DO': {
    sig: 'DO ... END_FOR / END_WHILE',
    doc: '循环体开始标记，后接循环代码块。'
  },
  'END_FOR': {
    sig: 'END_FOR;',
    doc: '结束 FOR 循环语句块。也可写作 ENDFOR（无下划线）。'
  },
  'ENDFOR': {
    sig: 'ENDFOR;',
    doc: '结束 FOR 循环语句块（短形式）。等同于 END_FOR。'
  },
  'WHILE': {
    sig: 'WHILE 条件 DO',
    doc: '条件循环语句，当条件为真时重复执行循环体。'
  },
  'END_WHILE': {
    sig: 'END_WHILE;',
    doc: '结束 WHILE 循环语句块。也可写作 ENDWHILE（无下划线）。'
  },
  'ENDWHILE': {
    sig: 'ENDWHILE;',
    doc: '结束 WHILE 循环语句块（短形式）。等同于 END_WHILE。'
  },
  'REPEAT': {
    sig: 'REPEAT ... UNTIL 条件',
    doc: '重复循环语句，至少执行一次循环体，直到条件为真时退出。'
  },
  'UNTIL': {
    sig: 'UNTIL 条件',
    doc: 'REPEAT 循环的终止条件，当条件为真时退出循环。'
  },
  'END_REPEAT': {
    sig: 'END_REPEAT;',
    doc: '结束 REPEAT 循环语句块。也可写作 ENDREPEAT（无下划线）。'
  },
  'ENDREPEAT': {
    sig: 'ENDREPEAT;',
    doc: '结束 REPEAT 循环语句块（短形式）。等同于 END_REPEAT。'
  },
  'CASE': {
    sig: 'CASE 变量 OF ... END_CASE',
    doc: '多分支选择语句，根据变量值执行对应的分支代码。'
  },
  'OF': {
    sig: 'CASE 变量 OF',
    doc: 'CASE 语句的必要组成部分，后接各分支条件。'
  },
  'END_CASE': {
    sig: 'END_CASE;',
    doc: '结束 CASE 多分支语句块。也可写作 ENDCASE（无下划线）。'
  },
  'ENDCASE': {
    sig: 'ENDCASE;',
    doc: '结束 CASE 多分支语句块（短形式）。等同于 END_CASE。'
  },
  'GOTO': {
    sig: 'GOTO 标签号',
    doc: '无条件跳转到指定标签（Nxxx）处继续执行。例如：GOTO 100; 跳转到 N100;'
  },
  'EXIT': {
    sig: 'EXIT;',
    doc: '立即退出当前循环（FOR/WHILE/REPEAT）。'
  },
  'PAUSE': {
    sig: 'PAUSE;',
    doc: '暂停宏程序执行，等待用户确认或外部信号后继续。'
  },
  // 运算符
  'AND': {
    sig: '条件1 AND 条件2',
    doc: '逻辑与运算符，两个条件都为真时结果为真。'
  },
  'OR': {
    sig: '条件1 OR 条件2',
    doc: '逻辑或运算符，任一条件为真时结果为真。'
  },
  'XOR': {
    sig: '条件1 XOR 条件2',
    doc: '逻辑异或运算符，两个条件不同时为真时结果为真。'
  },
  'NOT': {
    sig: 'NOT 条件',
    doc: '逻辑非运算符，取反条件的真假值。'
  },
  'MOD': {
    sig: '数值1 MOD 数值2',
    doc: '取模运算符，返回数值1 除以 数值2 的余数。'
  },
  'DIV': {
    sig: '数值1 DIV 数值2',
    doc: '整数除法运算符，返回商的整数部分（向下取整）。'
  },
  '&': {
    sig: '条件1 & 条件2',
    doc: '逻辑与运算符（简写形式），等同于 AND。'
  },
  // 机器人移动指令
  'MOVJ': {
    sig: 'MOVJ C1=... C2=... C3=... C4=... C5=... C6=... FJ=... PL=...',
    doc: '关节运动指令，各轴以最高速度独立运动到目标位置。适合大范围移动。'
  },
  'MOVJ-II': {
    sig: 'MOVJ-II X=... Y=... Z=... A=... B=... C=... FJ=... PL=...',
    doc: '关节运动指令（末端位置输入），指定末端坐标位置进行关节运动。'
  },
  'MOVL': {
    sig: 'MOVL X=... Y=... Z=... A=... B=... C=... FL=... FR=... PL=...',
    doc: '直线运动指令，末端沿直线路径运动到目标位置。FL 为直线速度，FR 为角速度。'
  },
  'MOVC': {
    sig: 'MOVC Xp=... Yp=... Zp=... X=... Y=... Z=... FL=... PL=...',
    doc: '圆弧运动指令，经过中间点 Xp/Yp/Zp 运动到终点 X/Y/Z。'
  },
  'INCMOVJ': {
    sig: 'INCMOVJ C1=... C2=... FJ=... PL=...',
    doc: '增量关节运动指令，以当前位置为基准进行增量移动。'
  },
  'INCMOVL': {
    sig: 'INCMOVL X=... Y=... Z=... FL=... PL=...',
    doc: '增量直线运动指令，以当前位置为基准沿直线增量移动。'
  },
  // 坐标系指令
  'USERCOR': {
    sig: 'USERCOR P1;',
    doc: '启用用户坐标系。P 指定坐标系编号。'
  },
  'OBJCORON': {
    sig: 'OBJCORON X... Y... Z... A... B... C...;',
    doc: '启用工件坐标系叠加，指定相对于当前坐标系的偏移。'
  },
  'OBJCOROFF': {
    sig: 'OBJCOROFF;',
    doc: '关闭工件坐标系叠加。'
  },
  'OBJCORCLEAR': {
    sig: 'OBJCORCLEAR;',
    doc: '清除所有工件坐标系叠加。'
  },
  'TOOLCOR': {
    sig: 'TOOLCOR T1;',
    doc: '启用工具坐标系。T 指定工具编号。'
  },
  'TOOLCORON': {
    sig: 'TOOLCORON T2;',
    doc: '启用指定工具坐标系。'
  },
  'TOOLCOROFF': {
    sig: 'TOOLCOROFF;',
    doc: '关闭工具坐标系。'
  },
  // 应用指令
  'SKIPCOND': {
    sig: 'SKIPCOND E1 Q33 R1 P1;',
    doc: '跳脱功能指令，当指定条件满足时跳过当前运动。'
  },
  'SKIP': {
    sig: 'MOVL X=... SKIP;',
    doc: '运动指令的跳脱标记，配合 SKIPCOND 使用。'
  },
  'SWAITSIG': {
    sig: 'SWAITSIG P1 Q33 R1 L100 T5000;',
    doc: '等待信号但不减速指令，等待指定信号时保持当前速度。'
  },
  'SYNCOUT': {
    sig: 'SYNCOUT S1 Q1 P50 R1;',
    doc: '同步输出指令，在运动过程中同步触发输出信号。'
  },
  'WEAVEON': {
    sig: 'WEAVEON P1; 或 WEAVEON E... Q... K... L... R...;',
    doc: '启用摆动功能，P 指定摆动模式编号，或直接指定摆动参数。'
  },
  'WEAVEOFF': {
    sig: 'WEAVEOFF;',
    doc: '关闭摆动功能。'
  },
  'STITCHON': {
    sig: 'STITCHON S1 Q100 L50 E10.;',
    doc: '启用连续脉冲输出功能。'
  },
  'STITCHOFF': {
    sig: 'STITCHOFF;',
    doc: '关闭连续脉冲输出功能。'
  },
  'POSEMAP': {
    sig: 'POSEMAP X=... Y=... Z=... A=... B=... C=... Q1 R1;',
    doc: '坐标转换指令，将当前坐标系映射到新的位姿。'
  },
  'SHIFTON': {
    sig: 'SHIFTON P1 X... Y... Z... A... B... C...;',
    doc: '启用点位偏移功能，P 指定偏移模式编号。'
  },
  'SHIFTOFF': {
    sig: 'SHIFTOFF;',
    doc: '关闭点位偏移功能。'
  },
  // 速度与轨迹参数
  'ACC': {
    sig: 'ACC 80;',
    doc: '设定加速度百分比（0-100）。也可作为运动指令参数：MOVJ ... ACC=80;'
  },
  'DEC': {
    sig: 'DEC 90;',
    doc: '设定减速度百分比（0-100）。也可作为运动指令参数：MOVJ ... DEC=90;'
  },
  'FJ': {
    sig: 'MOVJ ... FJ=50;',
    doc: '关节运动速度参数，单位 %（0-100）。'
  },
  'FEJ': {
    sig: 'MOVJ ... FEJ=100;',
    doc: '关节运动末端速度参数。'
  },
  'FL': {
    sig: 'MOVL ... FL=100.;',
    doc: '直线运动速度参数，单位 mm/s 或 inch/min。'
  },
  'FR': {
    sig: 'MOVL ... FR=10.;',
    doc: '直线运动角速度参数，单位 deg/s。'
  },
  'PL': {
    sig: 'MOVL ... PL=3;',
    doc: '定位等级参数（0-9），数值越大转角越平滑。'
  },
  'PQ': {
    sig: 'MOVL ... PQ=5;',
    doc: '定位品质参数。'
  },
  'PR': {
    sig: 'MOVL ... PR=1;',
    doc: '定位精度参数。'
  }
};

let _allKeywordsCache = null;

exports.getAllKeywords = function() {
  if (_allKeywordsCache) return _allKeywordsCache;
  _allKeywordsCache = [...new Set([
    ...exports.keywords.conditional,
    ...exports.keywords.repeat,
    ...exports.keywords.while,
    ...exports.keywords.for,
    ...exports.keywords.case,
    ...exports.keywords.flow,
    ...exports.keywords.operators,
    ...exports.keywords.robot
  ])];
  return _allKeywordsCache;
};

exports.getMCodeDesc = function(code) {
  const descs = {
    'M99': '子程序返回 / 宏程序结束',
    'M30': '程序结束并复位',
    'M65': '宏程序调用',
    'M98': '呼叫子程序',
    'M198': '呼叫子程序（另一路径）',
    'M96': '启用中断程序',
    'M97': '取消中断程序'
  };
  return descs[code] || 'M代码';
};

/**
 * 获取关键词详细说明
 * @param {string} keyword - 关键词
 * @returns {object|null} - 包含 sig 和 doc 的对象，或 null
 */
exports.getKeywordDoc = function(keyword) {
  return exports.keywordDocs[keyword] || null;
};