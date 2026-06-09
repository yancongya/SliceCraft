use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let resource_dir = app.path().resource_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."));

            let (backend_root, script_rel) = if cfg!(debug_assertions) {
                // 开发模式：项目根目录，脚本在 backend/app/main.py
                let root = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .parent().unwrap().to_path_buf();
                (root, std::path::PathBuf::from("backend").join("app").join("main.py"))
            } else {
                let up_dir = resource_dir.join("_up_").join("backend");
                let base = if up_dir.exists() { up_dir } else { resource_dir.join("backend") };
                (base, std::path::PathBuf::from("app").join("main.py"))
            };

            let backend_script = backend_root.join(&script_rel);

            // 使用 shell 插件启动 Python 进程
            // 开发模式: python3 backend/app/main.py
            // 生产模式: python3 <resource>/backend/app/main.py
            let backend_root2 = backend_root.clone();
            std::thread::spawn(move || {
                let status = std::process::Command::new("python3")
                    .arg(&backend_script)
                    .env("PYTHONPATH", &backend_root2)
                    .current_dir(&backend_root2)
                    .spawn();

                match status {
                    Ok(mut child) => {
                        println!("Python 后端已启动, PID: {}", child.id());
                        let _ = child.wait();
                    }
                    Err(e) => {
                        eprintln!("启动 Python 后端失败: {}", e);
                    }
                }
            });

            // 等待后端就绪
            std::thread::sleep(std::time::Duration::from_secs(3));

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("启动 SliceCraft 失败");
}
