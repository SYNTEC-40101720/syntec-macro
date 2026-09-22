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
  [DiagnosticCode.MISSING_SEMICOLON]: { title: '查看分号说明', message: '新代 MACRO 每条语句必须以分号 `;` 结尾；请补上分号以闭合该单节。' },
  [DiagnosticCode.CONTROL_STRUCTURE_TRAILING_SEMICOLON]: { title: '查看流程控制尾分号说明', message: 'IF/FOR/WHILE/CASE 等流程控制关键字行不需要分号；分号应放在流程体内部语句上。请删除该行尾分号。' },
  [DiagnosticCode.UNSUPPORTED_ELSIF]: { title: '改为 ELSEIF', message: '新代 MACRO 不支持 ELSIF，请改用 ELSEIF 语法。可直接应用 Quick Fix 替换。' },
  [DiagnosticCode.UNSUPPORTED_DEFAULT]: { title: '改为 ELSE', message: '新代 MACRO 不支持 DEFAULT，请改用 ELSE 语法。可直接应用 Quick Fix 替换。' },
  [DiagnosticCode.UNSUPPORTED_DIV]: { title: '改为 /', message: '新代 MACRO 不支持 DIV 运算符，除法请改用 `/`。可直接应用 Quick Fix 替换。' },
  [DiagnosticCode.UNSUPPORTED_EQUALITY_OPERATOR]: { title: '改为 =', message: '新代 MACRO 相等比较使用 `=`，不支持 `==`。可直接应用 Quick Fix 替换。' },
  [DiagnosticCode.UNSUPPORTED_INEQUALITY_OPERATOR]: { title: '改为 <>', message: '新代 MACRO 不等比较使用 `<>`，不支持 `!=`。可直接应用 Quick Fix 替换。' },
  [DiagnosticCode.UNSUPPORTED_LOGICAL_AND_OPERATOR]: { title: '改为 AND', message: '新代 MACRO 使用 `AND` 关键字，不支持 `&&`。可直接应用 Quick Fix 替换。' },
  [DiagnosticCode.UNSUPPORTED_LOGICAL_OR_OPERATOR]: { title: '改为 OR', message: '新代 MACRO 使用 `OR` 关键字，不支持 `||`。可直接应用 Quick Fix 替换。' },
  [DiagnosticCode.UNSUPPORTED_PERCENT_OPERATOR]: { title: '改为 MOD', message: '新代 MACRO 取余使用 `MOD` 关键字，不支持 `%`。可直接应用 Quick Fix 替换。' },
  [DiagnosticCode.UNSUPPORTED_LOGICAL_NOT_OPERATOR]: { title: '查看逻辑非说明', message: '新代 MACRO 使用 `NOT` 关键字，不支持 `!`；请改为 `NOT <条件>` 写法。' },
  [DiagnosticCode.UNSUPPORTED_COMPOUND_ASSIGNMENT]: { title: '查看复合赋值说明', message: '新代 MACRO 不支持 `+=` / `-=` / `*=` / `/=` 等复合赋值运算符；请展开为普通赋值，例如 `#1 := #1 + 1;`。' },
  [DiagnosticCode.UNSUPPORTED_INCREMENT]: { title: '查看自增自减说明', message: '新代 MACRO 不支持 `++` / `--` 运算符；请展开为普通赋值，例如 `#1 := #1 + 1;`。' },
  [DiagnosticCode.UNSUPPORTED_FANUC_COMPARISON]: { title: '查看 Fanuc 比较说明', message: '新代 MACRO 不支持 Fanuc 风格 `EQ/NE/GT/GE/LT/LE`；请改用新代运算符 `= / <> / > / >= / < / <=`。可直接应用 Quick Fix 替换。' },
  [DiagnosticCode.NAMED_LOCAL_VARIABLE]: '新代 MACRO 局部变量使用数字编号，例如 #1、#100 或 #[表达式]；#TEMP 这类命名局部变量不支持，需改为规划好的数字变量。',
  [DiagnosticCode.NAMED_GLOBAL_VARIABLE]: '新代 MACRO 公用变量使用数字编号，例如 @1、@1000 或 @[表达式]；@TEMP 这类命名公用变量不支持，需改为规划好的数字变量。',
  [DiagnosticCode.VACANT_ASSIGNMENT]: '#0/@0 为 VACANT，只读并表示空值；请不要作为赋值目标，可改用可写的数字变量。',
  [DiagnosticCode.PUBLIC_VAR_R_RESERVED_WRITE]: { title: '查看 R 寄存器保留区说明', message: '@ 映射的 R 寄存器保留区段（R0~R49 / R81~R102 / R512~R639 / R640~R1023 / R11000~R14999）不可写或唯读，写入可能导致不可预期行为；可改用可写区段 R50~R80 / R103~R511 / R1024~R4095 / R5800~R7999 / R10000~R10999 / R15000~R65535。' },
  [DiagnosticCode.ASSIGNMENT_STYLE_EQUALS]: { title: '查看赋值运算符说明', message: '新代 MACRO 赋值使用 `:=`（冒号等号），不支持单一 `=`；请在赋值位置补上冒号，例如 `#1 := 10;`。' },
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
  [DiagnosticCode.ROBOT_DEPRECATED_MOVJ_II]: { title: '查看 MOVJ II 弃用说明', message: 'MOVJ II 旧式语法已弃用，请改用 MOVJ 标准第一/第二语法；旧式 MOVJ II 仅作兼容性参考，不再推荐使用。' },
  [DiagnosticCode.ROBOT_MISSING_REQUIRED_ARG]: { title: '查看必填引数说明', message: 'INCMOVL 需要 P 引数；请按现场程序意图补入 P_。' },
  [DiagnosticCode.ROBOT_DIRECT_ARG_EQUALS]: { title: '查看机器人引数赋值说明', message: '机器人直接引数（P、L、K 等大写参数）应使用裸等号 `=` 而非赋值运算符 `:=`；请改为 `P1.0`、`L100` 这类直接写法，不要用 `P:=1.0`。' },
  [DiagnosticCode.ROBOT_G10_MODBUS_FORMAT]: { title: '查看 G10 Modbus 语法', message: 'G10 L1900 读取使用 C3 I_ A_ Q_ K_，写入使用 C6 I_ A_ X_；G10 L1901 自定义封包使用 P_ R_ Q_ [K_]。请勿混用两种语法的引数。' },
  [DiagnosticCode.ROBOT_G10_MODBUS_INTEGER]: { title: '查看 G10 Modbus 整数引数', message: 'G10 L1900/L1901 的静态引数必须使用十进制整数；请移除小数点或改用运行期变量。' },
  [DiagnosticCode.ROBOT_G10_MODBUS_RANGE]: { title: '查看 G10 Modbus 引数范围', message: 'G10 L1900/L1901 的 X 写入值范围为 0~65535，P/Q R 值编号范围为 0~65535，L1901 的 R 自定义资料数量不可超过 254；其他未明确上限的站号、装置地址和 K 数量不做臆测校验。' },
  [DiagnosticCode.ROBOT_STITCH_ARG_CONFLICT]: { title: '查看 STITCHON 引数说明', message: 'STITCHON 的 L/K 只能择一输入；请保留距离 L 或 K 中实际需要的一项。' },
  [DiagnosticCode.ROBOT_STITCH_MISSING_ARG]: { title: '查看 STITCHON 引数说明', message: 'STITCHON 需指定 L 或 K 其中一个；请按加工需求补入。' },
  [DiagnosticCode.ROBOT_STITCH_L_INTEGER]: { title: '查看 STITCHON L 引数说明', message: 'STITCHON 的 L 引数不可带小数点；请使用整数距离值。' },
  [DiagnosticCode.ROBOT_WEAVEON_MIXED_ARGS]: { title: '查看 WEAVEON 引数说明', message: 'WEAVEON 的 P 语法不可与 E/Q/K/L/R/I 细节引数混用；请选择参数组或细节参数其中一种写法。' },
  [DiagnosticCode.ROBOT_WEAVEON_Q_DECIMAL]: { title: '查看 WEAVEON Q 引数说明', message: 'WEAVEON 的 Q 频率建议使用小数形式，例如 Q1.0。' },
  [DiagnosticCode.ROBOT_UNSUPPORTED_COORDINATE_SYNTAX]: { title: '查看坐标系指令语法说明', message: 'USERCOR、TOOLCOR 和 G68.18 只接受官方坐标系引数，不可混入 CNC/机器人进给、G 码、轴向命令或移动指令。' },
  [DiagnosticCode.ROBOT_TOOLCOR_T_ARG]: { title: '查看 TOOLCOR T 引数说明', message: 'TOOLCOR 坐标系 T 引数已不再使用，请改用 P 引数（coordinate system number）或直接省略；T 仅作历史兼容提示，控制器实际以 P 为准。' },
  [DiagnosticCode.ROBOT_TOOLCORON_DEPRECATED]: { title: '查看 TOOLCORON 弃用说明', message: 'TOOLCORON 旧式坐标系激活语法已弃用，请改用 TOOLCOR 表示工具坐标系激活；旧式指令在新版本仅作兼容提示。' },
  [DiagnosticCode.ROBOT_TOOLCOR_CLEAR]: { title: '查看 TOOLCOR 清除说明', message: 'TOOLCOR 坐标系清除使用 TOOLCOR P0 或不含坐标引数的 TOOLCOR；不要混入非法引数，并确认是否已正确归零坐标系。' },
  [DiagnosticCode.ROBOT_MOVC_PAIR_REQUIRED]: { title: '查看 MOVC 成对规则', message: '旧式 MOVC 圆弧需要成对出现：第一行为中间点，第二行为结束点；新版单行写法需使用 X1/X2 点位组。' },
  [DiagnosticCode.ROBOT_MOVC_INTERMEDIATE_LIMIT]: { title: '查看 MOVC 中间指令上限', message: 'MOVC 中间点与结束点之间的中间单节上限为 10 笔（Macro 标准语法、注释与流程控制不计入）；超过即触发 RBT-127 圆弧运动单节间的指令数量已超过上限。建议将大量 G10/IO 参数前置到首段 MOVC 之前，或改用 @ 变量赋值由 PLC 间接写入。' },
  [DiagnosticCode.ROBOT_SWAITSIG_LIMIT]: { title: '查看 SWAITSIG 限制', message: '同一运动单节后只能下 1 个 SWAITSIG；多个条件请用 WAIT() 隔开或改用对应等待指令。' },
  [DiagnosticCode.ROBOT_SYNCOUT_LIMIT]: { title: '查看 SYNCOUT 限制', message: '同一有移动量移动单节最多允许 10 个 SYNCOUT；请拆分运动单节或减少同步输出。' },
  [DiagnosticCode.ROBOT_RANGE_FORBIDDEN_COMMAND]: { title: '查看机器人区间限制', message: '当前指令位于 STITCHON/WEAVEON/WAITSYNC/G192.1 等特殊区间内，控制器不支持该组合；请移出区间或关闭对应模式后再使用。' },
  [DiagnosticCode.ROBOT_STITCHON_FORBIDDEN_COMMAND]: { title: '查看 STITCHON 区间限制（RBT-115）', message: 'STITCHON 连续脉冲输出区间内仅支持笛卡尔直线/圆弧插补；遇到 MOVJ/USERCOR/SHIFTON/SYNCOUT/WEAVEON/WAITSYNC 等指令触发 RBT-115 连续脉冲输出不支援此指令。请关闭 STITCHOFF 后再使用，或改用 MOVL/MOVC。' },
  [DiagnosticCode.ROBOT_WEAVEON_FORBIDDEN_COMMAND]: { title: '查看 WEAVEON 区间限制（RBT-322）', message: 'WEAVEON 摆动作用区间内仅支持空间直线/圆弧运动；遇到 MOVJ/STITCHON/WAITSYNC 等指令触发 RBT-322 摆动不支援此指令。请先 WEAVEOFF 后再使用禁忌指令。' },
  [DiagnosticCode.ROBOT_WAITSYNC_FORBIDDEN_COMMAND]: { title: '查看 WAITSYNC 区间限制（RBT-257）', message: 'WAITSYNC 履带追踪同动作用区间内禁止嵌套动态点位偏移或其他不支持指令；遇到 SHIFTON/MOVJ/USERCOR/G04.1 与多数 M 码触发 RBT-257 履带追踪不支援此指令。请先 ENDSYNC 后再使用。' },
  [DiagnosticCode.ROBOT_G192_FORBIDDEN_COMMAND]: { title: '查看 G192.1 末端跟踪限制（RBT-123）', message: 'G192.1 末端跟踪生效区间内仅允许笛卡尔直线跟踪运动；遇到 MOVJ/INCMOVJ/MOVC/SWAITSIG/SYNCOUT/WEAVEON/WAITSYNC 等触发 RBT-123 末端跟踪不支援此指令。请先 G192.2 后再使用。' },
  [DiagnosticCode.ROBOT_G10_L1802_SILENT_VERSION_GATE]: { title: '查看 L1802 静音版本门槛', message: '静音模式（#1500=1 或 #1820 非零）下 G10 L1802 在 10.118.40R/42R/48C/50+ 版本族不支援；请确认控制器版本或清除静音模式后再使用 L1802。' },
  [DiagnosticCode.CONTROL_UNMATCHED_END]: { title: '查看 END 配对说明', message: 'IF/FOR/WHILE/CASE/REPEAT 块必须配对闭合关键字（END_IF / END_FOR / END_WHILE / END_CASE / UNTIL）；请检查对应的开块位置是否漏写或多写闭合。' },
  [DiagnosticCode.CONTROL_NESTING_ORDER]: { title: '查看嵌套顺序说明', message: '流程控制块的闭合必须与开块同序同型；请对齐 IF/END_IF、CASE/END_CASE、FOR/END_FOR、WHILE/END_WHILE、REPEAT/UNTIL 的层级关系。' },
  [DiagnosticCode.CONTROL_UNMATCHED_ELSE]: { title: '查看 ELSE 配对说明', message: 'ELSE 必须位于 IF ... END_IF 块中且仅出现一次；请确认外层 IF 与 END_IF 的位置，移除重复或错位的 ELSE。' },
  [DiagnosticCode.CONTROL_UNMATCHED_ELSEIF]: { title: '查看 ELSEIF 配对说明', message: 'ELSEIF 必须位于 IF ... END_IF 块中 ELSE 之前；请确认外层 IF 与 END_IF 的位置，并按 IF→ELSEIF→ELSE→END_IF 顺序排列。' },
  [DiagnosticCode.CONTROL_ELSEIF_AFTER_ELSE]: { title: '查看 ELSEIF 顺序说明', message: 'ELSEIF 不可出现在 ELSE 之后；请按 IF→ELSEIF...→ELSE→END_IF 的标准顺序调整位置。' },
  [DiagnosticCode.CONTROL_UNMATCHED_UNTIL]: { title: '查看 UNTIL 配对说明', message: 'REPEAT 块必须由 UNTIL 结束；请检查是否漏写 UNTIL、写错位置或由其他流程关键字截断。' },
  [DiagnosticCode.CONTROL_UNCLOSED_BLOCK]: { title: '查看未闭合块说明', message: '文件末尾存在未闭合的 IF/FOR/WHILE/CASE/REPEAT 块；请在末尾补上对应的 END_IF / END_FOR / END_WHILE / END_CASE / UNTIL 关键字。' },
  [DiagnosticCode.CONTROL_NESTING_DEPTH_EXCEEDED]: { title: '查看嵌套深度说明', message: '控制流 IF/CASE/REPEAT/WHILE/FOR 互相嵌套上限为 10 层，超过触发 COM-007 巢状超过 10 层。建议拆分子程序或扁平化嵌套结构。' }
};

module.exports = {
  BLOCK_CLOSERS,
  DIAGNOSTIC_HELP,
  DIAGNOSTIC_REPLACEMENTS,
  FANUC_COMPARISON_REPLACEMENTS
};