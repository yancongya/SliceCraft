use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let resource_dir = app.path().resource_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."));

            let backend_dir = if cfg!(debug_assertions) {
                std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .parent().unwrap().to_path_buf()
            } else {
                resource_dir.join("backend")
            };

            let backend_script = backend_dir.join("backend").join("app").join("main.py");

            // 使用 shell 插件启动 Python 进程
            // 开发模式: python3 backend/app/main.py
            // 生产模式: python3 <resource>/backend/app/main.py
            let backend_dir_clone = backend_dir.clone();
            std::thread::spawn(move || {
                let status = std::process::Command::new("python3")
                    .arg(&backend_script)
                    .env("PYTHONPATH", &backend_dir_clone)
                    .current_dir(&backend_dir_clone)
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
