const { DiagnosticCode } = require('./diagnosticCodes');

const DIAGNOSTIC_REPLACEMENTS = {
  [DiagnosticCode.UNSUPPORTED_ELSIF]: { title: '改为 ELSEIF', text: 'ELSEIF' },
  [DiagnosticCode.UNSUPPORTED_DEFAULT]: { title: '改为 ELSE', text: 'ELSE' },
  [DiagnosticCode.UNSUPPORTED_DIV]: { title: '改为 /', text: '/' },
  [DiagnosticCode.UNSUPPORTED_EQUALITY_OPERATOR]: { title: '改为 =', text: '=' },
  [DiagnosticCode.UNSUPPORTED_INEQUALITY_OPERATOR]: { title: '改为 <>', text: '<>' },
  [DiagnosticCode.UNSUPPORTED_LOGICAL_AND_OPERATOR]: { title: '改为 AND', text: 'AND' },
  [DiagnosticCode.UNSUPPORTED_LOGICAL_OR_OPERATOR]: { title: '改为 OR', text: 'OR' },
  [DiagnosticCode.UNSUPPORTED_PERCENT_OPERATOR]: { title: '改为 MOD', text: ' MOD ' }
};

const FANUC_COMPARISON_REPLACEMENTS = {
  EQ: '=',
  NE: '<>',
  GT: '>',
  GE: '>=',
  LT: '<',
  LE: '<='
};

const BLOCK_CLOSERS = {
  IF: 'END_IF;',
  FOR: 'END_FOR;',
  WHILE: 'END_WHILE;',
  CASE: 'END_CASE;'
};

const DIAGNOSTIC_HELP = {
  [DiagnosticCode.NAMED_LOCAL_VARIABLE]: '新代 MACRO 局部变量使用数字编号，例如 #1、#100 或 #[表达式]；#TEMP 这类命名局部变量不支持，需改为规划好的数字变量。',
  [DiagnosticCode.NAMED_GLOBAL_VARIABLE]: '新代 MACRO 公用变量使用数字编号，例如 @1、@1000 或 @[表达式]；@TEMP 这类命名公用变量不支持，需改为规划好的数字变量。',
  [DiagnosticCode.VACANT_ASSIGNMENT]: '#0/@0 为 VACANT，只读并表示空值；请不要作为赋值目标，可改用可写的数字变量。',
  [DiagnosticCode.INVALID_APP_VARIABLE_NUMBER]: 'AR/MAR APP 变量编号必须为非负整数；请使用 AR0、MAR53、AR[#1] 这类合法编号形式。',
  [DiagnosticCode.FUNCTION_MATH_DOMAIN]: { title: '查看函数定义域说明', message: '该数学函数的静态参数落在控制器定义域外；请调整为控制器允许的数值范围，避免运行时 COR 运算域错误。' },
  [DiagnosticCode.FUNCTION_IO_POINT_RANGE]: { title: '查看 I/O 点位范围说明', message: 'READ/SET I/O 点编号需为静态整数且落在控制器支持范围内；常见 DI/DO/A 点编号范围为 0~511。' },
  [DiagnosticCode.FUNCTION_IO_VALUE_RANGE]: { title: '查看 I/O 写入值说明', message: 'SETDO、SETABIT、SETRREGBIT 的写入值需为 0 或 1；请根据实际开/关意图调整。' },
  [DiagnosticCode.FUNCTION_R_REGISTER_RANGE]: { title: '查看 R 寄存器范围说明', message: 'READRREGBIT/SETRREGBIT 的 R 编号需为 0~65535 的整数。' },
  [DiagnosticCode.FUNCTION_R_BIT_RANGE]: { title: '查看 R bit 范围说明', message: 'READRREGBIT/SETRREGBIT 的 bit 编号需为 0~31 的整数。' },
  [DiagnosticCode.FUNCTION_ID_RANGE]: { title: '查看 ID 范围说明', message: 'ALARM/MSG 的静态 ID 需为 0~65535 的整数。' },
  [DiagnosticCode.FUNCTION_INTEGER_ARGUMENT]: { title: '查看整数参数说明', message: '该函数的静态参数需为整数；请移除小数点或改用运行期变量表达式。' },
  [DiagnosticCode.FUNCTION_CHKINF_CATEGORY_RANGE]: { title: '查看 CHKINF 类别说明', message: 'CHKINF 类别编号需为 1~5 的整数。' },
  [DiagnosticCode.FUNCTION_OPEN_COM_PORT]: { title: '查看 OPEN COM 说明', message: '串口传输埠语法为 OPEN("COM")；OPEN("COM1") 会按普通文件名处理。' },
  [DiagnosticCode.ROBOT_UNSUPPORTED_MOVC_POINT_ARG]: { title: '查看 MOVC 点位参数说明', message: 'MOVC 不支持 Xp/Yp/Zp 点写法；请改用成对 MOVC 的 X/Y/Z/A/B/C 直接引数，或新版 X1/X2 单行写法。' },
  [DiagnosticCode.ROBOT_SMOOTH_ARG_CONFLICT]: { title: '查看平滑引数说明', message: 'MOVL/MOVC/INCMOVL 单行只能使用 PL/PQ/PR 其中一种平滑引数；请保留实际需要的一项。' },
  [DiagnosticCode.ROBOT_UNSUPPORTED_SMOOTH_ARG]: { title: '查看平滑引数说明', message: 'MOVJ/INCMOVJ 不支持 PQ/PR；请使用 PL 或移除不支持的平滑引数。' },
  [DiagnosticCode.ROBOT_UNSUPPORTED_MOVJ_P_ARG]: { title: '查看 MOVJ P 引数说明', message: 'MOVJ 第一语法不支持 P 引数；若要使用点位/末端位置语法，请提供 X/Y/Z/A/B/C 等末端位置引数。' },
  [DiagnosticCode.ROBOT_MISSING_REQUIRED_ARG]: { title: '查看必填引数说明', message: 'INCMOVL 需要 P 引数；请按现场程序意图补入 P_。' },
  [DiagnosticCode.ROBOT_STITCH_ARG_CONFLICT]: { title: '查看 STITCHON 引数说明', message: 'STITCHON 的 L/K 只能择一输入；请保留距离 L 或 K 中实际需要的一项。' },
  [DiagnosticCode.ROBOT_STITCH_MISSING_ARG]: { title: '查看 STITCHON 引数说明', message: 'STITCHON 需指定 L 或 K 其中一个；请按加工需求补入。' },
  [DiagnosticCode.ROBOT_STITCH_L_INTEGER]: { title: '查看 STITCHON L 引数说明', message: 'STITCHON 的 L 引数不可带小数点；请使用整数距离值。' },
  [DiagnosticCode.ROBOT_WEAVEON_MIXED_ARGS]: { title: '查看 WEAVEON 引数说明', message: 'WEAVEON 的 P 语法不可与 E/Q/K/L/R/I 细节引数混用；请选择参数组或细节参数其中一种写法。' },
  [DiagnosticCode.ROBOT_WEAVEON_Q_DECIMAL]: { title: '查看 WEAVEON Q 引数说明', message: 'WEAVEON 的 Q 频率建议使用小数形式，例如 Q1.0。' },
  [DiagnosticCode.ROBOT_MOVC_PAIR_REQUIRED]: { title: '查看 MOVC 成对规则', message: '旧式 MOVC 圆弧需要成对出现：第一行为中间点，第二行为结束点；新版单行写法需使用 X1/X2 点位组。' },
  [DiagnosticCode.ROBOT_SWAITSIG_LIMIT]: { title: '查看 SWAITSIG 限制', message: '同一运动单节后只能下 1 个 SWAITSIG；多个条件请用 WAIT() 隔开或改用对应等待指令。' },
  [DiagnosticCode.ROBOT_SYNCOUT_LIMIT]: { title: '查看 SYNCOUT 限制', message: '同一有移动量移动单节最多允许 10 个 SYNCOUT；请拆分运动单节或减少同步输出。' },
  [DiagnosticCode.ROBOT_RANGE_FORBIDDEN_COMMAND]: { title: '查看机器人区间限制', message: '当前指令位于 STITCHON/WEAVEON/WAITSYNC/G192.1 等特殊区间内，控制器不支持该组合；请移出区间或关闭对应模式后再使用。' }
};

module.exports = {
  BLOCK_CLOSERS,
  DIAGNOSTIC_HELP,
  DIAGNOSTIC_REPLACEMENTS,
  FANUC_COMPARISON_REPLACEMENTS
};