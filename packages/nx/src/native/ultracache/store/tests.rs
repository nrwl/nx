use super::*;
use crate::native::db::initialize::initialize_db;
use serde_json::{Value as Json, json};
use sha2::{Digest, Sha256};
use std::fs;
use tempfile::TempDir;

fn store(dir: &TempDir) -> UltracacheConfigurationStore {
    let conn = initialize_db(&dir.path().join("store.db")).unwrap();
    UltracacheConfigurationStore::new(&External::new(Arc::new(Mutex::new(conn)))).unwrap()
}

fn import(
    store: &UltracacheConfigurationStore,
    commit: &str,
    json: &str,
) -> napi::Result<UltracacheConfigurations, String> {
    store.import_set(UltracacheConfigurationImportOptions {
        requested_commit: commit.into(),
        configurations_json: json.into(),
        hash_project_folder_state: None,
    })
}

fn object(dir: &TempDir, bytes: &[u8]) -> String {
    let sha = format!("{:x}", Sha256::digest(bytes));
    fs::write(dir.path().join(format!("{sha}.json")), bytes).unwrap();
    sha
}

fn import_files(
    store: &UltracacheConfigurationStore,
    dir: &TempDir,
    manifest: &Json,
) -> napi::Result<UltracacheConfigurations, String> {
    let path = dir.path().join("manifest.json");
    fs::write(&path, serde_json::to_vec(manifest).unwrap()).unwrap();
    store.import_files(
        "head".into(),
        path.to_str().unwrap().into(),
        dir.path().to_str().unwrap().into(),
    )
}

fn task(artifact: &str) -> Json {
    json!({"project":"p","commit":"parent","artifactId":artifact})
}

#[test]
fn legacy_imports_share_lists_and_each_version_stays_pinned() {
    let dir = tempfile::tempdir().unwrap();
    let db = store(&dir);
    let first = import(
        &db,
        "head",
        r#"{
        "a":{"commit":"parent","inputs":["shared","a","a"],"outputs":["dist/a"]},
        "b":{"commit":"head","inputs":["a","shared"],"extra":true}
    }"#,
    )
    .unwrap();
    let pinned = first.resolution().fetched_at;
    // The existing version may even be ahead of the wall clock.
    db.db
        .lock()
        .unwrap()
        .execute(
            "UPDATE io_snapshot_compact_versions SET fetched_at = ?1",
            [pinned + 1000],
        )
        .unwrap();
    let reopened = db.get_version("head".into(), pinned + 1000).unwrap();
    let latest = import(
        &db,
        "head",
        r#"{"a":{"commit":"head","inputs":["different"]}}"#,
    )
    .unwrap();
    assert_eq!(latest.resolution().fetched_at, pinned + 1001);
    assert_eq!(db.get("head".into()).unwrap().resolution().tasks, 1);
    let old = reopened.entries_for(&["a", "b", "c"]).unwrap();
    assert_eq!(old.len(), 2);
    assert!(Arc::ptr_eq(&old["a"], &old["b"]));
    assert_eq!(&*old["a"], &[Arc::from("a"), Arc::from("shared")]);
    assert!(latest.entries_for(&["b"]).unwrap().is_empty());
    assert!(db.get_version("other".into(), pinned + 1000).is_none());

    // Missing ids and hydrated artifacts are cached per handle.
    db.db
        .lock()
        .unwrap()
        .execute("DELETE FROM io_snapshot_compact_tasks", [])
        .unwrap();
    assert!(Arc::ptr_eq(
        &reopened.entries_for(&["b"]).unwrap()["b"],
        &old["a"]
    ));
    assert_eq!(reopened.cached_counts(), (3, 1, 2));
}

#[test]
fn reads_pre_dictionary_json_rows_and_reports_corruption() {
    let dir = tempfile::tempdir().unwrap();
    let db = store(&dir);
    let conn = db.db.lock().unwrap();
    conn.execute("INSERT INTO io_snapshot_versions VALUES ('head', 3, 3)", [])
        .unwrap();
    for (task, row) in [
        ("a", r#"{"commit":"parent","inputs":["a","shared"]}"#),
        ("b", r#"{"commit":"head","inputs":["shared"]}"#),
        ("bad", "{"),
    ] {
        conn.execute(
            "INSERT INTO io_snapshot_entries VALUES ('head', 3, ?1, ?2)",
            params![task, row],
        )
        .unwrap();
    }
    drop(conn);
    let old = db.get("head".into()).unwrap();
    assert_eq!(old.resolution().fetched_at, 3);
    let first = old.entries_for(&["a"]).unwrap();
    let next = old.entries_for(&["b"]).unwrap();
    assert!(Arc::ptr_eq(&first["a"][1], &next["b"][0]));
    assert!(old.entries_for(&["bad"]).is_err());
    let fresh = import(&db, "head", "{}").unwrap();
    assert!(fresh.resolution().fetched_at > 3);
    assert!(db.get_version("head".into(), 3).is_some());
    db.db
        .lock()
        .unwrap()
        .execute("UPDATE io_snapshot_versions SET tasks = 'bad'", [])
        .unwrap();
    assert!(db.get_version("head".into(), 3).is_none());
    assert!(db.get("head".into()).is_some());
}

#[test]
fn refuses_a_pin_that_a_legacy_writer_reused_for_another_version() {
    let dir = tempfile::tempdir().unwrap();
    let db = store(&dir);
    let pin = import(&db, "head", "{}").unwrap().resolution().fetched_at;
    db.db
        .lock()
        .unwrap()
        .execute(
            "INSERT INTO io_snapshot_versions VALUES ('head', ?1, 0)",
            [pin],
        )
        .unwrap();
    assert!(db.get_version("head".into(), pin).is_none());
    assert!(db.get("head".into()).is_none());
}

#[test]
fn rejects_invalid_legacy_responses_before_writing() {
    let dir = tempfile::tempdir().unwrap();
    let db = store(&dir);
    for payload in ["{", r#"{"task":{"commit":"head","inputs":{}}}"#] {
        assert_eq!(
            import(&db, "head", payload).err().unwrap().status,
            "INVALID_RESPONSE"
        );
    }
    assert!(db.get("head".into()).is_none());
}

#[test]
fn imports_a_large_mixed_bundle_once_and_reopens_only_the_requested_globs() {
    let dir = tempfile::tempdir().unwrap();
    let db = store(&dir);
    let page = br#"{"a":1,"!*.bad":9,"dist/out":11,"unrelated":20}"#;
    let page_id = object(&dir, page);
    let compact = br#"{"inputs":[9,1],"outputs":[11]}"#;
    let compact_id = object(&dir, compact);
    let logical = format!(
        "{:x}",
        Sha256::digest(br#"{"inputs":["!*.bad","a"],"outputs":["dist/out"]}"#)
    );
    let v2 = br#"{"inputs":["unrelated","a"],"outputs":["elsewhere"]}"#;
    let v2_id = object(&dir, v2);
    let empty = br#"{"inputs":[],"outputs":[]}"#;
    let empty_id = object(&dir, empty);
    let mut manifest = json!({
        "enabled":true, "updatedAt":42, "tasks":{"v2":task(&v2_id), "empty":task(&empty_id)},
        "artifacts":{
            &logical: {"sizeBytes":compact.len(),"storageVersion":3,"objectChecksum":compact_id,"dictionaryPageIds":[page_id]},
            &v2_id: {"sizeBytes":v2.len()},
            &empty_id: {"sizeBytes":empty.len(),"storageVersion":3,"objectChecksum":empty_id}
        },
        "dictionaryPages":{&page_id: {"sizeBytes":page.len()}}
    });
    let tasks = manifest["tasks"].as_object_mut().unwrap();
    let ids: Vec<_> = (0..40_000).map(|i| format!("p{i}:build")).collect();
    for id in &ids {
        tasks.insert(id.clone(), task(&logical));
    }
    let imported = import_files(&db, &dir, &manifest).unwrap();
    assert_eq!(imported.resolution().tasks, 40_002);
    assert_eq!(imported.cached_counts(), (0, 0, 0));
    fs::remove_file(dir.path().join(format!("{page_id}.json"))).unwrap();
    let worker = store(&dir)
        .get_version("head".into(), imported.resolution().fetched_at)
        .unwrap();
    let one = worker.entries_for(&["p0:build"]).unwrap();
    assert_eq!(&*one["p0:build"], &[Arc::from("!*.bad"), Arc::from("a")]);
    assert_eq!(worker.cached_counts(), (1, 1, 2));
    let other = worker.entries_for(&["v2", "empty"]).unwrap();
    assert!(other["empty"].is_empty());
    assert!(Arc::ptr_eq(&one["p0:build"][1], &other["v2"][0]));
    assert_eq!(worker.cached_counts(), (3, 3, 3));
    let many = worker
        .entries_for(&ids.iter().map(String::as_str).collect::<Vec<_>>())
        .unwrap();
    assert_eq!(many.len(), 40_000);
    assert!(
        many.values()
            .all(|inputs| Arc::ptr_eq(inputs, &one["p0:build"]))
    );
    assert_eq!(worker.cached_counts(), (40_002, 3, 3));
}

#[test]
fn rejects_corrupt_objects_references_and_versions_atomically() {
    let dir = tempfile::tempdir().unwrap();
    let db = store(&dir);
    let existing = import(&db, "head", "{}").unwrap().resolution().fetched_at;
    let page = br#"{"glob":0}"#;
    let page_id = object(&dir, page);
    let logical = format!(
        "{:x}",
        Sha256::digest(br#"{"inputs":["glob"],"outputs":[]}"#)
    );
    let wire = br#"{"inputs":[0],"outputs":[]}"#;
    let checksum = object(&dir, wire);
    let artifact = json!({"storageVersion":3,"objectChecksum":checksum,"sizeBytes":wire.len(),"dictionaryPageIds":[page_id]});
    let base = json!({"enabled":true,"updatedAt":1,"tasks":{"p":task(&logical)},"artifacts":{&logical:artifact},"dictionaryPages":{&page_id:{"sizeBytes":page.len()}}});
    let reject = |manifest: &Json| {
        assert_eq!(
            import_files(&db, &dir, manifest).err().unwrap().status,
            "INVALID_RESPONSE"
        );
        assert_eq!(
            db.get("head".into()).unwrap().resolution().fetched_at,
            existing
        );
    };
    for (field, value) in [
        ("storageVersion", json!(4)),
        ("sizeBytes", json!(wire.len() + 1)),
        ("objectChecksum", json!("../bad")),
        ("objectChecksum", Json::Null),
        ("dictionaryPageIds", json!([])),
        ("dictionaryPageIds", json!(["0".repeat(64)])),
    ] {
        let mut bad = base.clone();
        bad["artifacts"][&logical][field] = value;
        reject(&bad);
    }
    let mut missing = base.clone();
    missing["tasks"]["p"] = task(&"a".repeat(64));
    reject(&missing);
    for wrong_page in [
        br#"{"wrong":0}"#.as_slice(),
        br#"{"glob":0,"other":0}"#,
        br#"{"glob":1,"glob":0}"#,
        br#"{"glob":-1}"#,
    ] {
        let other = object(&dir, wrong_page);
        let mut bad = base.clone();
        bad["artifacts"][&logical]["dictionaryPageIds"] = json!([other]);
        bad["dictionaryPages"] = json!({other:{"sizeBytes":wrong_page.len()}});
        reject(&bad);
    }
    let mut bad_output = base.clone();
    let bytes = br#"{"inputs":[0],"outputs":[10]}"#;
    bad_output["artifacts"][&logical]["objectChecksum"] = json!(object(&dir, bytes));
    bad_output["artifacts"][&logical]["sizeBytes"] = json!(bytes.len());
    reject(&bad_output);
    fs::write(
        dir.path().join(format!("{checksum}.json")),
        vec![b' '; wire.len()],
    )
    .unwrap();
    reject(&base);
    object(&dir, wire);
    fs::write(
        dir.path().join(format!("{page_id}.json")),
        vec![b' '; page.len()],
    )
    .unwrap();
    reject(&base);
    object(&dir, page);
    assert!(import_files(&db, &dir, &base).is_ok());
}

#[test]
fn a_broken_stored_reference_is_never_used_as_an_empty_input_list() {
    let dir = tempfile::tempdir().unwrap();
    let db = store(&dir);
    let imported = import(&db, "head", r#"{"p":{"commit":"head","inputs":["input"]}}"#).unwrap();
    db.db
        .lock()
        .unwrap()
        .execute("DELETE FROM io_snapshot_compact_globs", [])
        .unwrap();
    assert!(imported.entries_for(&["p"]).is_err());
    db.db
        .lock()
        .unwrap()
        .execute("DELETE FROM io_snapshot_compact_artifacts", [])
        .unwrap();
    assert!(imported.entries_for(&["p"]).is_err());
}

#[test]
fn distinct_artifacts_intern_shared_page_strings_on_disk_and_in_the_worker() {
    let dir = tempfile::tempdir().unwrap();
    let db = store(&dir);
    const SHARED: usize = 256;
    const ARTIFACTS: usize = 128;
    let common: Vec<_> = (0..SHARED)
        .map(|i| format!("!libs/shared/long/path/{i}/**"))
        .collect();
    let individual: Vec<_> = (0..ARTIFACTS).map(|i| format!("libs/p{i}/**")).collect();
    let page = |strings: &[String], offset: usize| {
        let entries: HashMap<&str, usize> = strings
            .iter()
            .enumerate()
            .map(|(i, glob)| (glob.as_str(), offset + i))
            .collect();
        let bytes = serde_json::to_vec(&entries).unwrap();
        (object(&dir, &bytes), json!({"sizeBytes":bytes.len()}))
    };
    let (common_id, common_page) = page(&common, 0);
    let (individual_id, individual_page) = page(&individual, SHARED);
    let mut manifest = json!({"enabled":true,"updatedAt":5,"tasks":{},"artifacts":{},
        "dictionaryPages":{&common_id:common_page,&individual_id:individual_page}});
    for (i, glob) in individual.iter().enumerate() {
        let strings: Vec<_> = common.iter().chain([glob]).collect();
        let logical = format!(
            "{:x}",
            Sha256::digest(serde_json::to_vec(&json!({"inputs":strings,"outputs":[]})).unwrap())
        );
        let ids: Vec<_> = (0..SHARED).chain([SHARED + i]).collect();
        let bytes = serde_json::to_vec(&json!({"inputs":ids,"outputs":[]})).unwrap();
        let checksum = object(&dir, &bytes);
        manifest["artifacts"][&logical] = json!({"storageVersion":3,"objectChecksum":checksum,
            "dictionaryPageIds":[&common_id,&individual_id],"sizeBytes":bytes.len()});
        manifest["tasks"][format!("p{i}")] = task(&logical);
    }
    let imported = import_files(&db, &dir, &manifest).unwrap();
    let counts: (usize,usize) = db.db.lock().unwrap().query_row(
        "SELECT (SELECT COUNT(*) FROM io_snapshot_compact_globs), SUM(length(inputs)) FROM io_snapshot_compact_artifacts",
        [], |row| Ok((row.get(0)?, row.get(1)?)),
    ).unwrap().unwrap();
    assert_eq!(counts, (SHARED + ARTIFACTS, 4 * (SHARED + 1) * ARTIFACTS));
    let reopened = store(&dir)
        .get_version("head".into(), imported.resolution().fetched_at)
        .unwrap();
    let a = reopened.entries_for(&["p0"]).unwrap();
    let b = reopened.entries_for(&["p1"]).unwrap();
    assert_eq!(reopened.cached_counts(), (2, 2, SHARED + 2));
    for i in 0..SHARED {
        assert!(Arc::ptr_eq(&a["p0"][i], &b["p1"][i]));
    }
}

#[test]
fn the_folder_state_switch_is_pinned_with_its_version() {
    let dir = tempfile::tempdir().unwrap();
    let db = store(&dir);
    let config = br#"{"inputs":["a"],"outputs":[]}"#;
    let id = object(&dir, config);
    let manifest = |switch: Option<bool>| {
        let mut manifest = json!({
            "enabled":true, "updatedAt":1, "tasks":{"p:lint":task(&id)},
            "artifacts":{&id: {"sizeBytes":config.len()}}
        });
        if let Some(on) = switch {
            manifest["hashProjectFolderState"] = json!(on);
        }
        manifest
    };
    let on = import_files(&db, &dir, &manifest(Some(true))).unwrap();
    let off = import_files(&db, &dir, &manifest(Some(false))).unwrap();
    let absent = import_files(&db, &dir, &manifest(None)).unwrap();
    assert!(on.hashes_project_folder_state());
    assert!(!off.hashes_project_folder_state());
    assert!(!absent.hashes_project_folder_state());

    let reopen = |imported: &UltracacheConfigurations| {
        store(&dir)
            .get_version("head".into(), imported.resolution().fetched_at)
            .unwrap()
            .hashes_project_folder_state()
    };
    assert!(reopen(&on));
    assert!(!reopen(&off));
    assert!(!reopen(&absent));
    assert!(!db.get("head".into()).unwrap().hashes_project_folder_state());

    let json = r#"{"p:lint":{"commit":"c","inputs":["a"]}}"#;
    let legacy = import(&db, "legacy", json).unwrap();
    assert!(!legacy.hashes_project_folder_state());
    assert!(!reopen_commit(&dir, "legacy", &legacy));

    // The JSON import the Nx Cloud client re-imports a run with takes the switch too.
    let rehashed = db
        .import_set(UltracacheConfigurationImportOptions {
            requested_commit: "rehash".into(),
            configurations_json: json.into(),
            hash_project_folder_state: Some(true),
        })
        .unwrap();
    assert!(rehashed.hashes_project_folder_state());
    assert!(reopen_commit(&dir, "rehash", &rehashed));
    // A later import of the same commit is a new pin; the earlier one keeps its switch.
    let later = import(&db, "rehash", json).unwrap();
    assert_ne!(
        later.resolution().fetched_at,
        rehashed.resolution().fetched_at
    );
    assert!(!reopen_commit(&dir, "rehash", &later));
    assert!(reopen_commit(&dir, "rehash", &rehashed));
}

fn reopen_commit(dir: &TempDir, commit: &str, imported: &UltracacheConfigurations) -> bool {
    store(dir)
        .get_version(commit.into(), imported.resolution().fetched_at)
        .unwrap()
        .hashes_project_folder_state()
}
