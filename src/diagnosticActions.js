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
  CASE: 'END_CASE;',
  REPEAT: 'UNTIL ;'
};

const DIAGNOSTIC_HELP = {
  [DiagnosticCode.NAMED_LOCAL_VARIABLE]: '新代 MACRO 局部变量使用数字编号，例如 #1、#100 或 #[表达式]；#TEMP 这类命名局部变量不支持，需改为规划好的数字变量。',
  [DiagnosticCode.NAMED_GLOBAL_VARIABLE]: '新代 MACRO 公用变量使用数字编号，例如 @1、@1000 或 @[表达式]；@TEMP 这类命名公用变量不支持，需改为规划好的数字变量。',
  [DiagnosticCode.VACANT_ASSIGNMENT]: '#0/@0 为 VACANT，只读并表示空值；请不要作为赋值目标，可改用可写的数字变量。',
  [DiagnosticCode.PUBLIC_VAR_R_RESERVED_WRITE]: { title: '查看 R 寄存器保留区说明', message: '@ 映射的 R 寄存器保留区段（R0~R49 / R81~R102 / R512~R639 / R640~R1023 / R11000~R14999）不可写或唯读，写入可能导致不可预期行为；可改用可写区段 R50~R80 / R103~R511 / R1024~R4095 / R5800~R7999 / R10000~R10999 / R15000~R65535。' },
  [DiagnosticCode.INVALID_APP_VARIABLE_NUMBER]: 'AR/MAR APP 变量编号必须为非负整数；请使用 AR0、MAR53、AR[#1] 这类合法编号形式。',
  [DiagnosticCode.FUNCTION_MATH_DOMAIN]: { title: '查看函数定义域说明', message: '该数学函数的静态参数落在控制器定义域外；请调整为控制器允许的数值范围，避免运行时 COR 运算域错误。' },
  [DiagnosticCode.FUNCTION_IO_POINT_RANGE]: { title: '查看 I/O 点位范围说明', message: 'READ/SET I/O 点编号需为静态整数且落在控制器支持范围内；常见 DI/DO/A 点编号范围为 0~511。' },
  [DiagnosticCode.FUNCTION_IO_VALUE_RANGE]: { title: '查看 I/O 写入值说明', message: 'SETDO、SETABIT、SETRREGBIT 的写入值需为 0 或 1；请根据实际开/关意图调整。' },
  [DiagnosticCode.FUNCTION_R_REGISTER_RANGE]: { title: '查看 R 寄存器范围说明', message: 'READRREGBIT/SETRREGBIT 的 R 编号需为 0~65535 的整数。' },
  [DiagnosticCode.FUNCTION_R_BIT_RANGE]: { title: '查看 R bit 范围说明', message: 'READRREGBIT/SETRREGBIT 的 bit 编号需为 0~31 的整数。' },
  [DiagnosticCode.FUNCTION_ID_RANGE]: { title: '查看 ID 范围说明', message: 'ALARM/MSG 的静态 ID 需为 0~65535 的整数。' },
  [DiagnosticCode.FUNCTION_INTEGER_ARGUMENT]: { title: '查看整数参数说明', message: '该函数的静态参数需为整数；请移除小数点或改用运行期变量表达式。' },
  [DiagnosticCode.FUNCTION_DRVDATA_ARGUMENT_FORMAT]: { title: '查看 DRVDATA 引数格式', message: 'DRVDATA 第二引数需为十进制整数，或使用小写 h 结尾且内容仅含 0~F 的十六进制字串，例如 "D61h"。' },
  [DiagnosticCode.FUNCTION_CHKINF_CATEGORY_RANGE]: { title: '查看 CHKINF 类别说明', message: 'CHKINF 类别编号需为 1~5 的整数。' },
  [DiagnosticCode.FUNCTION_OPEN_COM_PORT]: { title: '查看 OPEN COM 说明', message: '串口传输埠语法为 OPEN("COM")；OPEN("COM1") 会按普通文件名处理。' },
  [DiagnosticCode.FUNCTION_AXID_QUOTED_AXIS]: { title: '查看 AXID 轴名说明', message: 'AXID 建议使用裸轴名，例如 AXID(Y)；带引号写法可能与控制器语法不一致，请依目标控制器确认。' },
  [DiagnosticCode.CALL_MACRO_NOT_LAST_G_CODE]: { title: '查看 G 码宏程序顺序说明', message: 'G65、G66、G66.1 必须是该行最后一个 G 码；同一单节多个 G 码宏程序时，控制器只执行最后一个。请按目标控制器语法调整顺序。' },
  [DiagnosticCode.ROBOT_UNSUPPORTED_MOVC_POINT_ARG]: { title: '查看 MOVC 点位参数说明', message: 'MOVC 不支持 Xp/Yp/Zp 点写法；请改用成对 MOVC 的 X/Y/Z/A/B/C 直接引数，或新版 X1/X2 单行写法。' },
  [DiagnosticCode.ROBOT_STATIC_ARG_RANGE]: { title: '查看 LTP 引数范围说明', message: '该机器人指令的静态引数超出 LTP 正式页面确认的范围，或需要使用整数；动态变量和表达式保持不静态推断。' },
  [DiagnosticCode.ROBOT_SMOOTH_ARG_CONFLICT]: { title: '查看平滑引数说明', message: 'MOVL/MOVC/INCMOVL 单行只能使用 PL/PQ/PR 其中一种平滑引数；请保留实际需要的一项。' },
  [DiagnosticCode.ROBOT_UNSUPPORTED_SMOOTH_ARG]: { title: '查看平滑引数说明', message: 'MOVJ/INCMOVJ 不支持 PQ/PR；请使用 PL 或移除不支持的平滑引数。' },
  [DiagnosticCode.ROBOT_UNSUPPORTED_MOVJ_P_ARG]: { title: '查看 MOVJ P 引数说明', message: 'MOVJ 第一语法不支持 P 引数；若要使用点位/末端位置语法，请提供 X/Y/Z/A/B/C 等末端位置引数。' },
  [DiagnosticCode.ROBOT_MISSING_REQUIRED_ARG]: { title: '查看必填引数说明', message: 'INCMOVL 需要 P 引数；请按现场程序意图补入 P_。' },
  [DiagnosticCode.ROBOT_G10_MODBUS_FORMAT]: { title: '查看 G10 Modbus 语法', message: 'G10 L1900 读取使用 C3 I_ A_ Q_ K_，写入使用 C6 I_ A_ X_；G10 L1901 自定义封包使用 P_ R_ Q_ [K_]。请勿混用两种语法的引数。' },
  [DiagnosticCode.ROBOT_G10_MODBUS_INTEGER]: { title: '查看 G10 Modbus 整数引数', message: 'G10 L1900/L1901 的静态引数必须使用十进制整数；请移除小数点或改用运行期变量。' },
  [DiagnosticCode.ROBOT_G10_MODBUS_RANGE]: { title: '查看 G10 Modbus 引数范围', message: 'G10 L1900/L1901 的 X 写入值范围为 0~65535，P/Q R 值编号范围为 0~65535，L1901 的 R 自定义资料数量不可超过 254；其他未明确上限的站号、装置地址和 K 数量不做臆测校验。' },
  [DiagnosticCode.ROBOT_SKIPCOND_Q_RANGE]: { title: '查看 SKIPCOND Q 引数说明', message: 'SKIPCOND 的 Q 引数必须为非负整数；E=3 时按 R 编号×100+bit 编码（R 编号范围为 0~65535，末两位 bit 为 00~15，例如 Q1874100 表示 R18741.00），E=1/2 时范围为 0~511。' },
  [DiagnosticCode.ROBOT_STITCH_ARG_CONFLICT]: { title: '查看 STITCHON 引数说明', message: 'STITCHON 的 L/K 只能择一输入；请保留距离 L 或 K 中实际需要的一项。' },
  [DiagnosticCode.ROBOT_STITCH_MISSING_ARG]: { title: '查看 STITCHON 引数说明', message: 'STITCHON 需指定 L 或 K 其中一个；请按加工需求补入。' },
  [DiagnosticCode.ROBOT_STITCH_L_INTEGER]: { title: '查看 STITCHON L 引数说明', message: 'STITCHON 的 L 引数不可带小数点；请使用整数距离值。' },
  [DiagnosticCode.ROBOT_WEAVEON_MIXED_ARGS]: { title: '查看 WEAVEON 引数说明', message: 'WEAVEON 的 P 语法不可与 E/Q/K/L/R/I 细节引数混用；请选择参数组或细节参数其中一种写法。' },
  [DiagnosticCode.ROBOT_WEAVEON_Q_DECIMAL]: { title: '查看 WEAVEON Q 引数说明', message: 'WEAVEON 的 Q 频率建议使用小数形式，例如 Q1.0。' },
  [DiagnosticCode.ROBOT_UNSUPPORTED_COORDINATE_SYNTAX]: { title: '查看坐标系指令语法说明', message: 'USERCOR、TOOLCOR 和 G68.18 只接受官方坐标系引数，不可混入 CNC/机器人进给、G 码、轴向命令或移动指令。' },
  [DiagnosticCode.ROBOT_MOVC_PAIR_REQUIRED]: { title: '查看 MOVC 成对规则', message: '旧式 MOVC 圆弧需要成对出现：第一行为中间点，第二行为结束点；新版单行写法需使用 X1/X2 点位组。' },
  [DiagnosticCode.ROBOT_SWAITSIG_Q_RANGE]: { title: '查看 SWAITSIG Q 引数说明', message: 'SWAITSIG 的 Q 引数必须为非负整数；P=2 时按 R 编号×100+bit 编码（R 编号范围为 0~65535，末两位 bit 为 00~15，例如 Q1874100 表示 R18741.00），P=1/3 时范围为 0~511。' },
  [DiagnosticCode.ROBOT_SWAITSIG_LIMIT]: { title: '查看 SWAITSIG 限制', message: '同一运动单节后只能下 1 个 SWAITSIG；多个条件请用 WAIT() 隔开或改用对应等待指令。' },
  [DiagnosticCode.ROBOT_SYNCOUT_Q_RANGE]: { title: '查看 SYNCOUT Q 引数说明', message: 'SYNCOUT 的 Q 引数必须为非负整数；S=2 时按 R 编号×100+bit 编码（R 编号范围为 0~65535，末两位 bit 为 00~15，例如 Q1874100 表示 R18741.00），S=1/3 时范围为 0~511。' },
  [DiagnosticCode.ROBOT_SYNCOUT_LIMIT]: { title: '查看 SYNCOUT 限制', message: '同一有移动量移动单节最多允许 10 个 SYNCOUT；请拆分运动单节或减少同步输出。' },
  [DiagnosticCode.ROBOT_RANGE_FORBIDDEN_COMMAND]: { title: '查看机器人区间限制', message: '当前指令位于 STITCHON/WEAVEON/WAITSYNC/G192.1 等特殊区间内，控制器不支持该组合；请移出区间或关闭对应模式后再使用。' },
  [DiagnosticCode.CONTROL_NESTING_DEPTH_EXCEEDED]: { title: '查看嵌套深度说明', message: '控制流 IF/CASE/REPEAT/WHILE/FOR 互相嵌套上限为 10 层，超过触发 COM-007 巢状超过 10 层。建议拆分子程序或扁平化嵌套结构。' }
};

module.exports = {
  BLOCK_CLOSERS,
  DIAGNOSTIC_HELP,
  DIAGNOSTIC_REPLACEMENTS,
  FANUC_COMPARISON_REPLACEMENTS
};