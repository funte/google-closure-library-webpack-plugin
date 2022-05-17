# gjd
For google-closure-compiler(hash: 819733415).  
`gjd(google-javascript-decompiler)` is a JavaScript decompiler for extracting Closure module information, its released with the google-closure-compiler, you can get the source [here](https://github.com/google/closure-compiler/blob/819733415/src/com/google/javascript/jscomp/j2clbuild/client/JsfileParserMain.java#L62). Build `gjd` is very difficult, but you can get a ready executable JavaScript bundle [here](https://github.com/google/closure-library/blob/8ad7d98dc1349e433a12eb4bf964992e489077ee/closure-deps/lib/jsfile_parser.js).  

## Questions
* How debug `gjd` source?  
  On my win10+vscode@1.56.1(with plugin vscode-starlark@0.3.1 and bazel@0.4.1)+bazelisk(npm version) environment, it's a big question!!  
  I can build out the jar file `compiler_unshaded_deploy.jar` with terminal cmd `bazelisk build //:compiler_unshaded_deploy.jar`, but the bazel plugin's panel view `Bazel Build TARGETS` always crash with message `Command failed: bazel --output_base=...`, and the startlark's debugging task died off in slience.  
  So finally, the bazel test command `bazelisk test //:test/com/google/javascript/jscomp/deps/JsFileFullParserTest --test_output=all` become the only way to spy what happens within the running `gjd` source, this test command will cost long time, but you can get little promotion from terminal with the Java code `System.out.println`, i uses it to trace the inner parser and log the AST structure like this:  
  ```sh
  Starting local Bazel server and connecting to it...
  INFO: Analyzed target //:test/com/google/javascript/jscomp/deps/JsFileFullParserTest (86 packages loaded, 2227 targets configured).
  INFO: Found 1 test target...
  INFO: Deleting stale sandbox base C:/users/funte/_bazel_funte/4otoakl4/sandbox
  Target //:test/com/google/javascript/jscomp/deps/JsFileFullParserTest up-to-date:
    bazel-bin/test/com/google/javascript/jscomp/deps/JsFileFullParserTest.jar
    bazel-bin/test/com/google/javascript/jscomp/deps/JsFileFullParserTest.exe
  INFO: Elapsed time: 30.943s, Critical Path: 1.41s
  INFO: 0 processes.
  INFO: Build completed successfully, 1 total action
  PASSED: //:test/com/google/javascript/jscomp/deps/JsFileFullParserTest (see C:/users/funte/_bazel_funte/4otoakl4/execroot/com_google_javascript_jscomp/bazel-out/x64_windows-fastbuild/testlogs/test/com/google/javascript/jscomp/deps/JsFileFullParserTest/test.log)
  INFO: From Testing //:test/com/google/javascript/jscomp/deps/JsFileFullParserTest
  ==================== Test output for //:test/com/google/javascript/jscomp/deps/JsFileFullParserTest:       
  JUnit4 Test Runner
  .
  Construct external AST:
    create script element IMPORT_DECLARATION
    create script element IDENTIFIER_EXPRESSION
    create script element MEMBER_EXPRESSION
    create script element LITERAL_EXPRESSION
    create script element ARGUMENT_LIST
    create script element CALL_EXPRESSION
    create script element EXPRESSION_STATEMENT
    create script element PROGRAM
  Translate external AST to rhino AST:
    found 2 elements in external AST, start trans:
      trans 0th element:
        trans IMPORT from IMPORT_DECLARATION, Node, "*", file.js(1, 1)->file.js(1, 33)
      trans 0th element:
        trans NAME from IDENTIFIER_EXPRESSION, StringNode, "goog", file.js(1, 34)->file.js(1, 38)
        trans NAME from IDENTIFIER_EXPRESSION, StringNode, "goog", file.js(1, 34)->file.js(1, 38)
        trans GETPROP from MEMBER_EXPRESSION, StringNode, "declareModuleid", file.js(1, 34)->file.js(1, 54)  
        trans STRINGLIT from LITERAL_EXPRESSION, StringNode, "foo", file.js(1, 55)->file.js(1, 60)
        trans CALL from CALL_EXPRESSION, Node, "*", file.js(1, 34)->file.js(1, 61)
        trans EXPR_RESULT from EXPRESSION_STATEMENT, Node, "*", file.js(1, 34)->file.js(1, 61)
        trans SCRIPT from PROGRAM, Node, "*", file.js(1, 1)->file.js(1, 61)
  AST tree:
      SCRIPT, Node, "*"
        MODULE_BODY, Node, "*"
          IMPORT, Node, "*"
            EMPTY, Node, "*"
            IMPORT_STAR, StringNode, "goog"
            STRINGLIT, StringNode, "base.js"
          EXPR_RESULT, Node, "*"
            CALL, Node, "*"
              GETPROP, StringNode, "declareModuleid"
                NAME, StringNode, "goog"
              STRINGLIT, StringNode, "foo"
  Travel ROOT...
    travel ROOT
      visit ROOT
  Travel SCRIPT...
    travel SCRIPT
    travel MODULE_BODY
    travel IMPORT
    travel EMPTY
      visit EMPTY
    travel IMPORT_STAR
      visit IMPORT_STAR
    travel STRINGLIT
      visit STRINGLIT
      visit IMPORT
    travel EXPR_RESULT
    travel CALL
    travel GETPROP
    travel NAME
      visit NAME
      visit GETPROP
    travel STRINGLIT
      visit STRINGLIT
      visit CALL
      visit EXPR_RESULT
      visit MODULE_BODY
      visit SCRIPT

  Time: 0.385

  OK (1 test)


  BazelTestRunner exiting with a return value of 0
  JVM shutdown hooks (if any) will run now.
  The JVM will exit once they complete.

  -- JVM shutdown starting at 2021-07-12 10:51:38 --

  ================================================================================
  //:test/com/google/javascript/jscomp/deps/JsFileFullParserTest  (cached) PASSED in 0.9s

  Executed 0 out of 1 test: 1 test passes.
  There were tests whose specified size is too big. Use the --test_verbose_timeout_warnings command line optiINFO: Build completed successfully, 1 total action
  ```
* Q: The target you are compiling requires Visual C++ build tools. Bazel couldn't find a valid Visual C++ build tools installation on your machine.  
  See https://github.com/bazelbuild/bazel/issues/5593  

## Call stack when parsing single JavaScript file
  ```java
  // [src/com/google/javascript/jscomp/j2clbuild/client/JsfileParserMain.java]
  public static JsPropertyMap<Object> gjd(String code, String filename, ...) {
    // [src/com/google/javascript/jscomp/deps/JsFileFullParser.java]
    JsFileFullParser.FileInfo info = JsFileFullParser.parse(...) {
      ...

      FileInfo info = new FileInfo();

      // [src/com/google/javascript/jscomp/parsing/ParserRunner.java]
      // 1. Run parser, get parsed result.
      ParserRunner.ParseResult parsed = ParserRunner.parse(...) {
        // [src/com/google/javascript/jscomp/parsing/parser/Parser.java]
        // 1-1. Construct external AST(deep first) and record comments.
        ProgramTree tree = p.parseProgram() {
          // Scan import/export and other statements, create tree element:
          //  create ImportDeclarationTree from import statement, see"parseAsyncFunctionDeclaration";
          //  create ExportDeclarationTree from export statement, see"parseExportDeclaration";
          //  create FunctionDeclarationTree from async function declaration, see"parseAsyncFunctionDeclaration";
          //  create FunctionDeclarationTree from function declaration, see"parseFunctionDeclaration";
          //  create ClassDeclarationTree from class declaration, see"parseClass";
          //  create VariableDeclarationListTree from let/const/var variable declaration, see"parseVariableStatement";
          //  create BlockTree from block curly, see"parseBlock";
          //  create EmptyStatementTree from empty statement, see"parseEmptyStatement";
          //  create IfStatementTree from if statement, see"parseIfStatement";
          //  create DoWhileStateTree from do-while statement, see"parseDoWhileStatement";
          //  create WhileStateTree from while statement, see"parseWhileStatement";
          //  create ForStatementTree from for/for-in/for-of/for-await-of statement, see"parseForStatement";
          //  create ContinueStatementTree from continue statement, see"parseContinueStatement";
          //  create BreakStatementTree from break statement, see"parseBreakStatement";
          //  create ReturnStatementTree from return statement, see"parseReturnStatement";
          //  create WithStatementTree from with statement, see"parseWithStatement";
          //  create SwitchStatementTree from switch statement, see"parseSwitchStatement";
          //  create ThrowStatementTree from throw statement, see"parseThrowStatement";
          //  create TryStatementTree from try statement, see"parseTryStatement";
          //  (x)create DebuggerStatement from debugger statement, see"parseDebuggerStatement". Not support, treat as ExpressionStatementTree;
          //  create LabelledStatementTree from labelled statement, see"parseLabelledStatement";
          //  create ExpressionStatementTree from expression statement, see"parseExpressionStatement";
          ImmutableList<ParseTree> sourceElements = parseGlobalSourceElements();
        }

        // [src/com/google/javascript/jscomp/parsing/IRFactory.java]
        // 1-2. Translate external AST to rhino AST:
        //  * if a goog module or ES module, insert a Token.MODULE_BODY node as first child, see "processAstRoot";
        //  * statement tree element map(part): 
        //    element-type                  rhino-node-type     process-function
        //    | --------------------------- | ----------------- | ------------- |
        //    PROGRAM                       SCRIPT              processAstRoot
        //    EXPRESSION_STATEMENT          EXPR_RESULT         processExpressionStatement
        //    CALL_EXPRESSION               CALL...             processFunctionCall
        //    VARIABLE_STATEMENT            VAR, CONST, LET     processVariableDeclarationList
        //    TODO: figureout non synthetic and function node.
        //  * common element maps(part):
        //    VARIABLE_DECLARATION_LIST     -                   processVariableDeclarationList
        //    VARIABLE_DECLARATION          -                   processVariableDeclaration
        //    LITERAL_EXPRESSION            STRINGLIT           processString
        //    MEMBER_EXPRESSION             GETPROP             processPropertyGet
        //    IDENTIFIER_EXPRESSION         NAME                processName
        //    OBJECT_LITERAL_EXPRESSION     OBJECTLIT           processObjectLiteral
        // And parse lang features(see FeatureSet) and set root node properties(see Node.Prop):
        //  * if find directive "use strict", set root node prop Node.USE_STRUCT, see "parseDirectives";
        //  * if a goog module, set root node prop Node.GOOG_MODULE, see "processAstRoot";
        //  * if a ES module, set root node prop Node.ES6_MODULE, see "processAstRoot";
        //  * collect other lang features to IRFactory.features, use to detect lang version;
        IRFactory factory = IRFactory.transformTree(tree, ...);
        
        // Get rhino AST root node.
        root = factory.getResultNode();
        // Collect lang features.
        features = features.union(factory.getFeatures());
        root.putProp(Node.FEATURE_SET, features);
          
        // 1-3. Parse comments.
        comments = p.getComments();

        return new ParseResult(root, comments, features, ...);
      } /* ParserRunner.parse */

      // 2. Collect information from comments.
      //  TODO: customAnnotations;
      //  TODO: hasSoyDelcalls;
      //  TODO: hasSoyDeltemplates;
      //  TODO: isConfig;
      //  TODO: isExterns;
      //  TODO: modName;
      //  TODO: mods;
      //  TODO: requiresCss;
      //  TODO: visibility;
      for (Comment comment : parsed.comments) {
        if (comment.type == Comment.Type.JSDOC) {
          parseComment(comment, info);
        }
      }

      // [src/com/google/javascript/jscomp/GatherModuleMetadata.java]
      // 3. Travel(deep first) rhino AST and gather module meta data(ModuleMetadata):
      //  * rootNode(): AST node that represents the root of this module, see "enterModule";
      //  * usesClosure(): Whether this file uses Closure Library at all.
      //    when occurs a NAME node with value "goog", if its variable but from import statement or not variable, set this flag, see "visitName";
      //    when occurs a NAME node with value "goog", if this is a bundle file with base.js in it, set this flag, see "visitGoogCall";
      //  * isTestOnly(): Whether goog.setTestOnly was called.
      //    flag this file only used for testing when occurs goog.setTestOnly statement, see "visitGoogCall"; 
      //  * moduleType(): Module type.
      //    collect stage:
      //      set ModuleType.SCRIPT default;
      //      set ModuleType.ES6_MODULE when occurs ES6 import/export statement, see "visitImportOrExport";
      //      set ModuleType.GOOG_PROVIDE when occurs goog.provide, see "visitGoogCall";
      //      set ModuleType.GOOG_MODULE when occurs goog.module, see "visitGoogCall";
      //      record the node when occurs goog.module.declareLegacyNamespace, see "visitGoogCall";
      //      record the node when occurs goog.declareModuleId or goog.module.declareNamespace(has deprecated), see "visitGoogCall";
      //      set ModuleType.COMMON_JS when occurs commonJS export statement, see "visit";
      //    resolve stage, see "ModuleMetadataBuilder.build";
      //  * stronglyRequiredGoogNamespaces(): Closure namespaces this file strongly requires, i.e., arguments to goog.require calls.
      //    collect the namespace when occurs goog.require, see "visitGoogCall";
      //  * weaklyRequiredGoogNamespaces(): Closure namespaces this file weakly requires, i.e., arguments to goog.requireType calls.
      //    collect the namespace when occurs goog.requireType, see "visitGoogCall";
      //  * es6ImportSpecifiers(): Raw text of all ES6 import specifiers (includes "export from" as well).
      //    collect the imported module when occurs import statement, see "visitImportOrExport";
      //    collect the dynamic imported module when occurs dynamic import statement, see "visitDynamicImport";
      //  * googNamespaces(): Closure namespaces that this file is associated with. Created by goog.provide, goog.module, and goog.declareModuleId.
      //    collect the namespaces when occurs goog.provide/module/declareModuleId, see "visitGoogCall";
      //  * nestedModules(): Nested modules.
      //    collect the nested modules when occurs goog.loadModule, see "leaveModule";
      gatherModuleMetadata.process(new Node(Token.ROOT), parsed.ast);
      
      // 4. Collect information from the module meta data.
      //  loadFlags.lang: lang version.
      //  loadFlags.module: goog module or ES6 module or unset.
      //    set "es6" if ModuleType.ES6_MODULE;
      //    set "module" if ModuleType.GOOG_MODULE or ModuleType.LEGACY_GOOG_MODULE;
      //    other unset;
      //  goog: whether uses Closure Library.
      //  importedModules: imported ES6 moduels.
      //  provides: namespaces that this file is associated with.
      //  requires: strong required namespaces.
      //  testonly: whether only for testing.
      //  typeRequires: weak required namespaces.
      return info;
    } /* JsFileFullParser.parse */

    // 5. Collect final information.
    //  TODO: provideGoog;
    if (info.provideGoog) {
      info.provides.add("goog");
    } else if (info.goog) {
      info.requires.add("goog");
    }
    return new SparseObject()
        .set("custom_annotations", info.customAnnotations)
        .set("goog", info.goog)
        .set("has_soy_delcalls", info.hasSoyDelcalls)
        .set("has_soy_deltemplates", info.hasSoyDeltemplates)
        .set("imported_modules", info.importedModules)
        .set("is_config", info.isConfig)
        .set("is_externs", info.isExterns)
        .set("load_flags", info.loadFlags)
        .set("modName", info.modName)
        .set("mods", info.mods)
        .set("provide_goog", info.provideGoog)
        .set("provides", info.provides)
        .set("requires", info.requires)
        .set("requiresCss", info.requiresCss)
        .set("testonly", info.testonly)
        .set("type_requires", info.typeRequires)
        .set("visibility", info.visibility)
        .object;
  } /* gjd */
  ```