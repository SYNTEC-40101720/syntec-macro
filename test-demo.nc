%@MACRO

// ============================================================
// syntec-macro 插件功能验证测试文件
// 涵盖所有已实现的语言服务特性
// 打开此文件后可直接观察各功能表现
// ============================================================

// --- 1. 基本语法高亮测试 ---
#1 := 100;
#2 := 200;
@1 := 500;
@1000 := 600;

// --- 2. 控制流诊断 + 代码折叠测试 ---
IF #1 > 50 THEN
  #3 := 1;
  IF #3 = 1 THEN
    #4 := 10;
  END_IF;
END_IF;

// --- 3. FOR 循环 ---
FOR #1 := 1 TO 10 DO
  #2 := #2 + #1;
  IF #2 > 30 THEN
    GOTO 100;
  END_IF;
END_FOR;

// --- 4. WHILE 循环 ---
#5 := 0;
WHILE #5 < 5 DO
  #5 := #5 + 1;
END_WHILE;

// --- 5. REPEAT/UNTIL 三元结构 ---
#6 := 0;
REPEAT
  #6 := #6 + 1;
  IF #6 > 3 THEN
    EXIT;
  END_IF;
UNTIL #6 >= 5
END_REPEAT;

// --- 6. CASE 分支（冒号语法）---
#10 := 2;
CASE #10 OF
  1: #11 := 100;
  2: #11 := 200;
  3: #11 := 300;
  ELSE: #11 := 0;
END_CASE;

// --- 7. GOTO 标签与引用 ---
N100;
G00 X0. Y0.;
G01 X100. F1000.;
GOTO 200;

N200;
G01 X200. Y200.;

// --- 8. 子程序调用（测试 Call Hierarchy）---
G65 P1000;
G66 P1000;

// --- 9. 语义标记 + 悬停文档 -- 
#100 := ABS(#101);
#102 := FLOOR(#103);
#104 := SQRT(#105);
#106 := ROUND(#107);

// --- 10. 注释块（测试格式化）---
// This is a continuous comment
// Used to test comment block alignment
// Line 3 should align with line 1

(*
  This is a multi-line block comment
  Used to test block comment formatting
*)

// --- 11. Quick Fix 测试（诊断修复）---
#20 := 100;
IF #20 > 50 THEN
  #21 := 1;
END_IF;

// --- 12. 中文字符检测 ---
// Comment with Chinese is allowed
#30 := 100;
#31 := 200;

// --- 13. G/M 代码补全测试 ---
G00 X0. Y0.;
G01 X100. Y50. F1000.;
G02 X150. Y100. I50.;
M03 S1000;
M05;
M06 T1;
M08;
M09;
M30;

// --- 14. 机器人指令测试 ---
MOVJ C1=0 C2=0 FJ=50 PL=5;
MOVL X100. Y0. Z0. FL=100;
USERCOR 1;

// --- 15. 布尔运算符测试 ---
IF (#1 > 10) & (#2 < 50) THEN
  #30 := 1;
END_IF;

IF (#1 = 1) AND (#2 = 2) THEN
  #31 := 1;
END_IF;

// --- 16. MOD 运算符测试 ---
#40 := 100 MOD 7;

// --- 17. 新版 G 码测试 ---
G04.102 I1 X100;
G68.18 P1 X10. Y20. Z30.;
G192.1 P1 Q100 R1;

// --- 18. 函数签名测试 ---
ALARM(1001);
ALARM(1002, "Drill broken");
MSG(100);
MSG("Test message");
MSG(200, "Custom msg");
SLEEP(100);
#50 := GETPR(3500);
SETPR(3500, #50);

// --- 19. 轴群辨识符号测试 ---
$1;
#60 := 100;
$2;
#61 := 200;

M99;